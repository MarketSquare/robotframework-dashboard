// Build the docs site for every released version plus the unreleased `main`.
//
// Layout of docs/.vitepress/dist after a run:
//   /                 latest release tag
//   /dev/             main (unreleased)
//   /vX.Y.Z/          every tag >= MIN_TAG
//   /vX.Y.Z/          every PyPI release before MIN_TAG: README as a single page
//                     (scripts/docs/legacy-docs-versions.json maps them to commits)
//   /versions.json    machine-readable list, also feeds the version switcher
//
// Each version is checked out into a temporary git worktree, the *current*
// docs/.vitepress config + theme and scripts/docs/copy-static.mjs are copied over it
// (so old versions get the switcher, banner and mermaid support), and VitePress
// is run against that worktree with node_modules of this checkout.
//
// Usage:
//   node scripts/docs/build-versioned-docs.mjs                     all versions
//   node scripts/docs/build-versioned-docs.mjs --only latest,dev,v1.3.0,v0.9.4   subset, for local iteration
//   node scripts/docs/build-versioned-docs.mjs --only legacy       only the README-only versions
//   node scripts/docs/build-versioned-docs.mjs --main-ref origin/main
//   node scripts/docs/build-versioned-docs.mjs --cache-dir .docs-dist-cache
//
// Env: DOCS_MAIN_REF (same as --main-ref, default "main"),
//      DOCS_CACHE_DIR (same as --cache-dir).
//
// Cache: released versions never change, so with a cache dir each finished
// build is stored there under a fingerprint (commit + everything overlaid +
// whether it is the latest release). A later run copies matching versions out
// of the cache instead of rebuilding them; `dev` is always rebuilt. CI keeps
// that dir between runs with actions/cache. The version switcher and banner
// read /versions.json at runtime, so a new release does not invalidate the
// cached builds of the older ones.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const MIN_TAG = 'v1.3.0'; // first tag that ships docs/
const SITE_BASE = '/robotframework-dashboard/';
const GITHUB = 'https://github.com/MarketSquare/robotframework-dashboard';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const distDir = resolve(repoRoot, 'docs/.vitepress/dist');
// Inside the repo on purpose: node resolves `vitepress`, `vue`, `mermaid` for the
// overlaid config/theme by walking up to <repoRoot>/node_modules.
const worktreesDir = resolve(repoRoot, '.docs-worktrees');
const vitepressBin = resolve(repoRoot, 'node_modules/vitepress/bin/vitepress.js');
// Untagged releases before MIN_TAG: { "0.9.4": { commit, released } }
const LEGACY = JSON.parse(readFileSync(resolve(repoRoot, 'scripts/docs/legacy-docs-versions.json'), 'utf-8'));

// Files copied from this checkout over every historical one.
const OVERLAY = [
  'docs/.vitepress/config.mts',
  'docs/.vitepress/theme',
  'scripts/docs/copy-static.mjs',
];

// Tags are immutable, so markdown mistakes that break the VitePress build
// (dead links) are fixed here, per tag, as literal text replacements applied
// to the worktree. Every entry must match, otherwise the build fails loudly.
const PATCHES = {
  'v1.3.1': [
    { file: 'docs/dashboard-server.md', from: '(http://localhost:5173/robotframework-dashboard/advanced-cli-examples.html#offline-dependencies)', to: '(/advanced-cli-examples#offline-dependencies)' },
  ],
  'v1.4.0': [
    { file: 'docs/basic-command-line-interface-cli.md', from: '(/settings/#general-settings-graphs-tab)', to: '(/settings#general-settings-graphs-tab)' },
    { file: 'docs/customization.md', from: '(/settings/#general-settings-graphs-tab)', to: '(/settings#general-settings-graphs-tab)' },
  ],
};

function parse_args(argv) {
  const args = { only: null, mainRef: process.env.DOCS_MAIN_REF || 'main', cacheDir: process.env.DOCS_CACHE_DIR || null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') args.only = new Set(argv[++i].split(',').map((s) => s.trim()).filter(Boolean));
    else if (argv[i] === '--main-ref') args.mainRef = argv[++i];
    else if (argv[i] === '--cache-dir') args.cacheDir = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (args.cacheDir) args.cacheDir = resolve(repoRoot, args.cacheDir);
  return args;
}

function git(...args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf-8' }).trim();
}

function semver(tag) {
  return tag.slice(1).split('.').map(Number);
}

function compare_semver(a, b) {
  const [aa, bb] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (aa[i] !== bb[i]) return aa[i] - bb[i];
  return 0;
}

function release_tags() {
  return git('tag', '-l', 'v*')
    .split('\n')
    .filter((t) => /^v\d+\.\d+\.\d+$/.test(t))
    .filter((t) => compare_semver(t, MIN_TAG) >= 0)
    .sort(compare_semver);
}

function legacy_versions() {
  return Object.keys(LEGACY).sort((a, b) => compare_semver(`v${a}`, `v${b}`));
}

function plan_builds(tags, mainRef) {
  const latest = tags[tags.length - 1];
  const label = (tag) => tag.slice(1);
  return [
    { name: 'latest', ref: latest, label: label(latest), prefix: '' },
    { name: 'dev', ref: mainRef, label: 'dev', prefix: 'dev/' },
    ...[...tags].reverse().map((tag) => ({ name: tag, ref: tag, label: label(tag), prefix: `${tag}/` })),
    ...legacy_versions().reverse().map((v) => ({ name: `v${v}`, ref: LEGACY[v].commit, label: v, prefix: `v${v}/`, legacy: true })),
  ];
}

// versions.json: dev, then releases newest first; the latest one lives at the
// site root. README-only releases carry `legacy: true`. Read at runtime by
// docs/.vitepress/theme/versions.ts (switcher + banner).
function version_entries(tags) {
  const latest = tags[tags.length - 1];
  const entries = [{ label: 'dev', link: `${SITE_BASE}dev/` }];
  for (const tag of [...tags].reverse()) {
    const isLatest = tag === latest;
    const released = git('log', '-1', '--format=%cd', '--date=short', tag);
    entries.push({ label: tag.slice(1), link: isLatest ? SITE_BASE : `${SITE_BASE}${tag}/`, ...(isLatest && { latest: true }), released });
  }
  for (const v of legacy_versions().reverse()) {
    entries.push({ label: v, link: `${SITE_BASE}v${v}/`, legacy: true, released: LEGACY[v].released });
  }
  return entries;
}

// --- build cache -------------------------------------------------------------

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

// Everything this checkout contributes to a historical build.
function overlay_hash() {
  const hash = createHash('sha256');
  const add = (path) => {
    if (statSync(path).isDirectory()) {
      for (const name of readdirSync(path).sort()) add(resolve(path, name));
      return;
    }
    hash.update(relative(repoRoot, path)).update('\0').update(readFileSync(path)).update('\0');
  };
  for (const rel of [...OVERLAY, 'scripts/docs/build-versioned-docs.mjs', 'scripts/docs/legacy-docs-versions.json', 'package-lock.json']) {
    add(resolve(repoRoot, rel));
  }
  return hash.digest('hex');
}

function fingerprint(build, latest, overlayHash) {
  const commit = git('rev-parse', `${build.ref}^{commit}`);
  return sha256([build.name, build.prefix, build.label, commit, `latest=${build.ref === latest}`, overlayHash].join('\n'));
}

function cache_entry(cacheDir, build) {
  return resolve(cacheDir, build.name.replace(/[^\w.-]/g, '_'));
}

// A cached build is only a copy of its dist directory next to the fingerprint
// it was made with; anything else in the cache dir is ignored.
function restore_from_cache(cacheDir, build, print) {
  const entry = cache_entry(cacheDir, build);
  const stamp = resolve(entry, 'fingerprint');
  if (!existsSync(stamp) || readFileSync(stamp, 'utf-8').trim() !== print) return false;
  cpSync(resolve(entry, 'dist'), resolve(distDir, build.prefix), { recursive: true });
  return true;
}

function store_in_cache(cacheDir, build, print) {
  const entry = cache_entry(cacheDir, build);
  rmSync(entry, { recursive: true, force: true });
  mkdirSync(entry, { recursive: true });
  // the root build is copied before any sub-directory build lands in dist
  cpSync(resolve(distDir, build.prefix), resolve(entry, 'dist'), { recursive: true });
  writeFileSync(resolve(entry, 'fingerprint'), `${print}\n`);
}

// --- README-only versions --------------------------------------------------

const MARKDOWN_REF = /(!?)\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)|(<img\b[^>]*\ssrc=")([^"]+)(")/g;
const EXTERNAL_REF = /^(?:[a-z]+:|#)/i;
// GitHub Pages of the repo before it moved to MarketSquare; 404 today
const OLD_PAGES = 'https://timdegroot1996.github.io/robotframework-dashboard/';

// Rewrites the README's repo-relative references for a docs page that lives in
// docs/index.md of a throw-away docs dir:
//   images                        -> copied into docs/public, served from this version
//   example/robot_dashboard.html  -> the copy scripts/docs/copy-static.mjs makes
//   any other file / directory    -> GitHub, pinned to the release commit
function rewrite_readme_refs(readme, worktree, build) {
  const unresolved = [];
  const resolve_ref = (target, isImage) => {
    if (target.startsWith(OLD_PAGES)) target = target.slice(OLD_PAGES.length);
    else if (EXTERNAL_REF.test(target)) return target;
    const [path, hash = ''] = target.replace(/^\.?\//, '').split('#');
    const file = resolve(worktree, path);
    if (!existsSync(file)) {
      unresolved.push(target);
      return `${GITHUB}/blob/${build.ref}/${path}`;
    }
    if (isImage) {
      const dest = resolve(worktree, 'docs/public', path);
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(file, dest);
      return `/${path}`;
    }
    if (path === 'example/robot_dashboard.html') return '/example/robot_dashboard.html';
    const kind = statSync(file).isDirectory() ? 'tree' : 'blob';
    return `${GITHUB}/${kind}/${build.ref}/${path}${hash && `#${hash}`}`;
  };
  const rewritten = readme.replace(MARKDOWN_REF, (match, bang, text, target, title, imgOpen, imgSrc, imgClose) => {
    if (imgOpen) return `${imgOpen}${resolve_ref(imgSrc, true)}${imgClose}`;
    return `${bang}[${text}](${resolve_ref(target, bang === '!')}${title})`;
  });
  if (unresolved.length) console.log(`[legacy] ${build.name}: not in the checkout, linked to GitHub anyway: ${unresolved.join(', ')}`);
  return rewritten;
}

function legacy_page(worktree, build) {
  const { released } = LEGACY[build.label];
  const minor = build.label.split('.').slice(0, 2).join('.');
  const siblings = legacy_versions().filter((v) => v !== build.label && v.startsWith(`${minor}.`));
  const readme = readFileSync(resolve(worktree, 'README.md'), 'utf-8');
  const head = [
    '---',
    `title: RobotDashboard ${build.label}`,
    '---',
    '',
    `::: info Version ${build.label} — README documentation`,
    `Released on ${released} ([PyPI](https://pypi.org/project/robotframework-dashboard/${build.label}/), [source](${GITHUB}/tree/${build.ref})).`,
    'Releases before 1.3.0 had no documentation site: this page is the README that shipped with the release.',
    ':::',
    '',
  ];
  // sibling links point at other builds: raw <a target="_self"> keeps them out of
  // the VitePress router and its dead-link check
  const foot = siblings.length
    ? ['', `## Other ${minor}.x releases`, '', siblings.map((v) => `<a href="../v${v}/" target="_self">v${v}</a>`).join(' · '), '']
    : [];
  return [...head, rewrite_readme_refs(readme, worktree, build), ...foot].join('\n');
}

// Replaces whatever docs/ the checkout has (usually nothing) with a one-page
// docs dir; the shared overlay and copy-static.mjs run on top of it afterwards.
function prepare_legacy_docs(worktree, build) {
  const docs = resolve(worktree, 'docs');
  rmSync(docs, { recursive: true, force: true });
  mkdirSync(resolve(docs, 'public'), { recursive: true });
  for (const name of readdirSync(resolve(repoRoot, 'docs/public'))) {
    // logos and icons config.mts / the theme need; videos and the example dir stay out
    if (name.endsWith('.svg')) cpSync(resolve(repoRoot, 'docs/public', name), resolve(docs, 'public', name));
  }
  writeFileSync(resolve(docs, 'index.md'), legacy_page(worktree, build));
}

function apply_patches(worktree, build) {
  for (const { file, from, to } of PATCHES[build.name] ?? []) {
    const path = resolve(worktree, file);
    const text = readFileSync(path, 'utf-8');
    if (!text.includes(from)) throw new Error(`patch for ${build.name} does not apply: "${from}" not found in ${file}`);
    writeFileSync(path, text.replaceAll(from, to));
    console.log(`[patch] ${file}: "${from}" -> "${to}"`);
  }
}

function overlay(worktree) {
  for (const rel of OVERLAY) {
    const src = resolve(repoRoot, rel);
    const dest = resolve(worktree, rel);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true });
  }
}

// The demo videos in docs/public are ~66 MB and identical in every tag; copying
// them into 17 builds blows the 1 GB GitHub Pages limit. Every non-root build
// drops the ones whose blob matches the latest release and references the root
// copy instead (config.mts rewrites the markdown, see DOCS_SHARED_ASSETS).
function strip_shared_assets(worktree, build, latest) {
  if (build.prefix === '') return [];
  const shared = [];
  for (const name of readdirSync(resolve(worktree, 'docs/public'))) {
    if (!name.endsWith('.mp4')) continue;
    let same = false;
    try {
      same = git('rev-parse', `${build.ref}:docs/public/${name}`) === git('rev-parse', `${latest}:docs/public/${name}`);
    } catch {
      // not present in the latest release: keep the local copy
    }
    if (!same) continue;
    rmSync(resolve(worktree, 'docs/public', name));
    shared.push(name);
  }
  if (shared.length) console.log(`[shared] served from the site root: ${shared.join(', ')}`);
  return shared;
}

function build_one(build, env, latest) {
  const worktree = resolve(worktreesDir, build.name.replace(/[^\w.-]/g, '_'));
  const outDir = resolve(distDir, build.prefix);
  console.log(`\n=== ${build.name} (${build.ref}) -> ${SITE_BASE}${build.prefix}`);
  rmSync(worktree, { recursive: true, force: true });
  git('worktree', 'prune');
  git('worktree', 'add', '--detach', worktree, build.ref);
  try {
    if (build.legacy) prepare_legacy_docs(worktree, build);
    overlay(worktree);
    apply_patches(worktree, build);
    const sharedAssets = strip_shared_assets(worktree, build, latest);
    execFileSync(process.execPath, [resolve(worktree, 'scripts/docs/copy-static.mjs')], {
      cwd: worktree,
      stdio: 'inherit',
      env: { ...process.env, DOCS_STORAGE_NAMESPACE: build.label },
    });
    execFileSync(process.execPath, [vitepressBin, 'build', resolve(worktree, 'docs'), '--outDir', outDir], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...env,
        DOCS_BASE: `${SITE_BASE}${build.prefix}`,
        DOCS_VERSION: build.label,
        DOCS_SHARED_ASSETS: sharedAssets.join(','),
      },
    });
  } finally {
    git('worktree', 'remove', '--force', worktree);
  }
}

function main() {
  const args = parse_args(process.argv.slice(2));
  if (!existsSync(vitepressBin)) throw new Error(`vitepress not installed: ${vitepressBin} (run npm ci)`);

  const tags = release_tags();
  if (!tags.length) throw new Error(`No release tags >= ${MIN_TAG} found (git fetch --tags?)`);
  const latest = tags[tags.length - 1];
  const entries = version_entries(tags);
  const env = { DOCS_LATEST: latest.slice(1) };

  let builds = plan_builds(tags, args.mainRef);
  if (args.only) {
    const unknown = [...args.only].filter((name) => name !== 'legacy' && !builds.some((b) => b.name === name));
    if (unknown.length) throw new Error(`--only: unknown versions ${unknown.join(', ')} (known: legacy, ${builds.map((b) => b.name).join(', ')})`);
    builds = builds.filter((b) => args.only.has(b.name) || (args.only.has('legacy') && b.legacy));
  }
  console.log(`Building ${builds.length} docs version(s): ${builds.map((b) => b.name).join(', ')}`);

  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(worktreesDir, { recursive: true });
  const overlayHash = args.cacheDir ? overlay_hash() : null;
  const updatedMarker = args.cacheDir && resolve(args.cacheDir, '.updated');
  if (args.cacheDir) {
    mkdirSync(args.cacheDir, { recursive: true });
    rmSync(updatedMarker, { force: true });
    console.log(`Cache: ${args.cacheDir} (overlay ${overlayHash.slice(0, 12)})`);
  }
  const started = Date.now();
  let restored = 0;
  try {
    // root build first: Vite may empty an outDir that lies inside the docs root
    for (const build of builds) {
      const cacheable = args.cacheDir && build.name !== 'dev';
      const print = cacheable ? fingerprint(build, latest, overlayHash) : null;
      if (cacheable && restore_from_cache(args.cacheDir, build, print)) {
        console.log(`=== ${build.name}: restored from cache`);
        restored++;
        continue;
      }
      build_one(build, env, latest);
      if (cacheable) {
        store_in_cache(args.cacheDir, build, print);
        // tells CI that the cache dir changed and is worth saving again
        writeFileSync(updatedMarker, `${new Date().toISOString()}\n`);
      }
    }
  } finally {
    rmSync(worktreesDir, { recursive: true, force: true });
    git('worktree', 'prune');
  }

  mkdirSync(distDir, { recursive: true });
  writeFileSync(resolve(distDir, 'versions.json'), JSON.stringify(entries, null, 2) + '\n');
  const cached = args.cacheDir ? `, ${restored} from cache` : '';
  console.log(`\nDone: ${builds.length} version(s) in ${Math.round((Date.now() - started) / 1000)}s${cached} -> ${distDir}`);
}

try {
  main();
} catch (error) {
  console.error(`\nbuild-versioned-docs failed: ${error.message}`);
  process.exit(1);
}
