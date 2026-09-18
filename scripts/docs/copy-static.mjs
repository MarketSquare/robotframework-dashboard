import { mkdirSync, copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'node:path';

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function copyFileRelative(srcRel, destRel) {
  const src = resolve(process.cwd(), srcRel);
  const dest = resolve(process.cwd(), destRel);
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
  console.log(`[copy] ${srcRel} -> ${destRel}`);
}

function copyHtmlOnly(srcRel, destRel) {
  const src = resolve(process.cwd(), srcRel);
  const dest = resolve(process.cwd(), destRel);
  if (!existsSync(src)) {
    // older tags built by scripts/docs/build-versioned-docs.mjs predate this directory
    console.log(`[copy.html] skip ${srcRel} (missing)`);
    return;
  }
  ensureDir(dest);
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = resolve(src, entry.name);
    const rel = srcPath.substring(resolve(process.cwd()).length + 1); // relative from cwd
    const destPath = resolve(dest, entry.name);
    if (entry.isDirectory()) {
      copyHtmlOnly(rel, resolve(destRel, entry.name));
    } else if (entry.isFile()) {
      const lower = entry.name.toLowerCase();
      if (lower.endsWith('.html') || lower.endsWith('.htm')) {
        ensureDir(dirname(destPath));
        copyFileSync(srcPath, destPath);
        console.log(`[copy.html] ${rel} -> ${destPath.substring(resolve(process.cwd()).length + 1)}`);
      }
    }
  }
}

// Every docs version ships its own example dashboard, but they all share one
// origin and the same localStorage keys ("settings", "theme"). A settings blob
// written by a newer dashboard can break an older one, so the versioned build
// (scripts/docs/build-versioned-docs.mjs) passes DOCS_STORAGE_NAMESPACE and the
// copy gets a shim that prefixes every localStorage key with the version.
function namespace_local_storage(destRel, namespace) {
  const dest = resolve(process.cwd(), destRel);
  const shim = `<script>(function(p){var S=Storage.prototype,g=S.getItem,s=S.setItem,r=S.removeItem;function k(t,x){return t===localStorage?p+x:x}S.getItem=function(x){return g.call(this,k(this,x))};S.setItem=function(x,v){return s.call(this,k(this,x),v)};S.removeItem=function(x){return r.call(this,k(this,x))}})(${JSON.stringify(`robotdashboard-docs:${namespace}:`)});</script>`;
  const html = readFileSync(dest, 'utf-8');
  if (!html.includes('<head>')) throw new Error(`${destRel}: no <head> to inject the localStorage shim into`);
  writeFileSync(dest, html.replace('<head>', `<head>${shim}`));
  console.log(`[namespace] ${destRel}: localStorage keys prefixed for ${namespace}`);
}

// Copy example dashboard HTML into VitePress public so it deploys to GitHub Pages
// (releases before 0.5 have no example dashboard; config.mts then hides the nav link)
if (existsSync(resolve(process.cwd(), 'example/robot_dashboard.html'))) {
  copyFileRelative('example/robot_dashboard.html', 'docs/public/example/robot_dashboard.html');
  if (process.env.DOCS_STORAGE_NAMESPACE) {
    namespace_local_storage('docs/public/example/robot_dashboard.html', process.env.DOCS_STORAGE_NAMESPACE);
  }
} else {
  console.log('[copy] skip example/robot_dashboard.html (missing)');
}

// Copy only HTML files from Robot Framework outputs into VitePress public
copyHtmlOnly('tests/robot/resources/outputs', 'docs/public/example/tests/robot/resources/outputs');
