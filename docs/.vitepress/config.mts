import { defineConfig, type DefaultTheme } from 'vitepress'
import { existsSync, readFileSync } from "fs";
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The docs directory this config lives in. When scripts/docs/build-versioned-docs.mjs
// overlays this file onto a git worktree of an older tag, all paths must resolve
// relative to *that* checkout, never to process.cwd().
const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(docsRoot, '..');

const python_svg = readFileSync(resolve(docsRoot, 'public/python.svg'), "utf-8");
const slack_svg = readFileSync(resolve(docsRoot, 'public/slack.svg'), "utf-8");

// Read version from version.py
const versionFile = resolve(repoRoot, 'robotframework_dashboard/version.py');
const versionMatch = existsSync(versionFile) ? readFileSync(versionFile, "utf-8").match(/Robotdashboard\s+([\d.]+)/) : null;
const version = versionMatch ? versionMatch[1] : "unknown";

// Versioned-docs inputs. All optional: `npm run docs:dev` / `docs:build` without
// them produce the single-version site exactly as before.
//   DOCS_BASE          VitePress `base` for this build (e.g. /robotframework-dashboard/v2.1.0/)
//   DOCS_VERSION       label of this build: "2.2.0" or "dev"
//   DOCS_LATEST        label of the latest release; only "is this build the latest?" matters here,
//                      the version switcher and banner read /versions.json at runtime (theme/versions.ts)
//   DOCS_SHARED_ASSETS comma-separated docs/public files that only the root build ships;
//                      raw-HTML `src="/<file>"` references are pointed at the live root site
const siteRoot = 'https://marketsquare.github.io/robotframework-dashboard/';
const rootBase = '/robotframework-dashboard/';
const base = process.env.DOCS_BASE ?? rootBase;
const docsVersion = process.env.DOCS_VERSION ?? version;
const docsLatest = process.env.DOCS_LATEST ?? docsVersion;
const isRootBuild = base === rootBase;
const showBanner = docsVersion !== docsLatest;

const sharedAssets = (process.env.DOCS_SHARED_ASSETS ?? '').split(',').filter(Boolean);

function rewrite_shared_assets(html: string): string {
  for (const name of sharedAssets) {
    html = html.replaceAll(`src="/${name}"`, `src="${siteRoot}${name}"`);
  }
  return html;
}

// The site root (latest release + versions.json) lives outside this VitePress
// app. VitePress prefixes `base` onto every link that starts with "/", so the
// link is made relative to this build's base (all pages sit flat under it).
function sibling_link(absoluteLink: string): string {
  const rel = posix.relative(base, absoluteLink);
  return rel ? `${rel}/` : './';
}

// README-only builds have a single page and (before 0.5) no example dashboard
const has_page = (page: string) => existsSync(resolve(docsRoot, page));

// The sidebar lists every page the *current* docs have. Older tags lack some of
// them, so entries whose markdown file is missing from the checkout are dropped.
function existing_pages(items: DefaultTheme.SidebarItem[]): DefaultTheme.SidebarItem[] {
  const kept: DefaultTheme.SidebarItem[] = [];
  for (const item of items) {
    if (item.items) {
      const children = existing_pages(item.items);
      if (children.length) kept.push({ ...item, items: children });
      continue;
    }
    if (item.link && !existsSync(resolve(docsRoot, item.link.replace(/^\//, '')))) continue;
    kept.push(item);
  }
  return kept;
}

type HeadEntry = NonNullable<Parameters<typeof defineConfig>[0]['head']>[number];

// The VersionBanner is fixed at the top of the page; VitePress moves its own
// fixed navbar/sidebar down by --vp-layout-top-height. Set it statically so the
// server-rendered page has no layout jump.
const bannerHead: HeadEntry[] = showBanner
  ? [["style", {}, ":root{--vp-layout-top-height:36px}@media (max-width:640px){:root{--vp-layout-top-height:56px}}"]]
  : [];

const seoHead: HeadEntry[] = isRootBuild
  ? [["link", { rel: "canonical", href: siteRoot }]]
  : [
      // /dev/ and /vX.Y.Z/ builds must not compete with the live site in search results
      ["meta", { name: "robots", content: "noindex" }],
      ["link", { rel: "canonical", href: siteRoot }],
    ];

export default defineConfig({
  title: "RobotDashboard",
  description: "Robot Framework Dashboard and Result Database command line tool",
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/robotframework-dashboard/robotframework.svg" }],
    ["meta", { name: "theme-color", content: "#5f67ee" }],

    // SEO
    ["title", {}, "RobotFramework Dashboard | Visualize and Analyze Test Results"],
    ["meta", { name: "description", content: "Interactive dashboard to visualize, analyze, and customize Robot Framework test results with charts, and tables" }],
    ["meta", { name: "keywords", content: "dashboard, analysis, robot-framework, html-report, robotframework, robotframework-dashboard" }],
    ...seoHead,
    ...bannerHead,

    // Open Graph
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:locale", content: "en" }],
    ["meta", { property: "og:title", content: "RobotFramework Dashboard | Visualize Robot Framework Results" }],
    ["meta", { property: "og:site_name", content: "RobotFramework Dashboard" }],
    ["meta", { property: "og:image", content: "/robotframework-dashboard/robotframework.svg" }],
    ["meta", { property: "og:url", content: siteRoot }],

    // Twitter Card
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: "RobotFramework Dashboard | Visualize Robot Framework Results" }],
    ["meta", { name: "twitter:description", content: "Interactive dashboard to visualize and analyze Robot Framework test results." }],
    ["meta", { name: "twitter:image", content: "/robotframework-dashboard/robotframework.svg" }],

    // Structured data
    ["script", { type: "application/ld+json" }, `
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "RobotFramework Dashboard",
        "url": "${siteRoot}",
        "description": "Interactive dashboard to visualize and analyze Robot Framework test results.",
        "applicationCategory": "DeveloperTool",
        "operatingSystem": "Web"
      }
    `]
  ],
  base,
  markdown: {
    config(md) {
      const fence = md.renderer.rules.fence!
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        if (token.info.trim() === 'mermaid') {
          return `<pre class="mermaid">${md.utils.escapeHtml(token.content)}</pre>`
        }
        return fence(tokens, idx, options, env, self)
      }
      if (sharedAssets.length) {
        // the <video><source src="/x.mp4"> tags are raw HTML in the markdown
        for (const rule of ['html_block', 'html_inline'] as const) {
          const original = md.renderer.rules[rule]!
          md.renderer.rules[rule] = (tokens, idx, options, env, self) =>
            rewrite_shared_assets(original(tokens, idx, options, env, self))
        }
      }
    }
  },
  themeConfig: {
    // custom keys read by theme/versions.ts through useData().theme
    docsVersion,
    docsLatest,
    docsLatestLink: sibling_link(rootBase),
    docsVersionsUrl: `${sibling_link(rootBase)}versions.json`,
    search: {
      provider: 'local'
    },
    nav: [
      { text: 'Home', link: '/' },
      ...(has_page('getting-started.md') ? [{ text: 'Documentation', link: '/getting-started.md' }] : []),
      ...(has_page('public/example/robot_dashboard.html') ? [{ text: 'Example Dashboard', link: '/example/robot_dashboard.html', target: '_self' }] : []),
      // the version switcher is a theme component (VersionSwitcher.vue), not a nav item
    ],
    sidebar: existing_pages([
      {
        text: 'Setup',
        items: [
          { text: '🚀 Getting Started', link: '/getting-started.md' },
          { text: '📦 Installation & Version Info', link: '/installation-version-info.md' },
        ]
      },
      {
        text: 'Command Line',
        items: [
          { text: '💻 Basic Command Line Interface (CLI)', link: '/basic-command-line-interface-cli.md' },
          { text: '⚡ Advanced CLI & Examples', link: '/advanced-cli-examples.md' },
        ]
      },
      {
        text: 'Dashboard',
        items: [
          { text: '🗂️ Tabs / Pages', link: '/tabs-pages.md' },
          { text: '📊 Graphs & Tables', link: '/graphs-tables.md' },
          { text: '🔍 Filtering', link: '/filtering.md' },
          { text: '🎨 Customization', link: '/customization.md' },
          { text: '⚙️ Settings', link: '/settings.md' },
        ]
      },
      {
        text: 'Advanced',
        items: [
          { text: '📐 Architecture', link: '/architecture.md' },
          { text: '🖥️ Dashboard Server', link: '/dashboard-server.md' },
          { text: '🗄️ Custom Database Class', link: '/custom-database-class.md' },
          { text: '🔔 Listener Integration', link: '/listener-integration.md' },
          { text: '📂 Log Linking', link: '/log-linking.md' },
          { text: '📈 Performance', link: '/performance.md' },
        ]
      },
        { text: '🤝 Contributions', link: '/contributions.md' }
    ]),
    socialLinks: [
      { icon: 'github', link: 'https://github.com/marketsquare/robotframework-dashboard', ariaLabel: 'GitHub Repository' },
      { icon: { svg: python_svg }, link: 'https://pypi.org/project/robotframework-dashboard/', ariaLabel: 'Python Package on PyPI' },
      { icon: { svg: slack_svg }, link: 'https://robotframework.slack.com/', ariaLabel: 'Robot Framework Slack' },
    ]
  },
  vite: {
    build: {
      // mermaid's core chunk is ~650 kB; it is only loaded on pages with a
      // diagram (dynamic import in theme/index.ts), so the 500 kB warning is noise
      chunkSizeWarningLimit: 1000,
    },
    plugins: [{
      name: 'serve-root-example-file',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          const normalizedUrl = url.startsWith(base) ? '/' + url.slice(base.length) : url;

          if (normalizedUrl === '/example/robot_dashboard.html') {
            const filePath = resolve(repoRoot, 'example/robot_dashboard.html');
            const html = readFileSync(filePath, 'utf-8');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(html);
            return;
          }
          if (normalizedUrl && normalizedUrl.startsWith('/tests/robot/resources/outputs/')) {
            const relativePath = normalizedUrl.replace(/^\//, '');
            const filePath = resolve(repoRoot, relativePath);
            try {
              const html = readFileSync(filePath, 'utf-8');
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(html);
              return;
            } catch (e) {
              // Not found, continue to next middleware
            }
          }
          next();
        });
      }
    }]
  }
})
