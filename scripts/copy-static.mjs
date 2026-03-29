import { mkdirSync, copyFileSync, existsSync, readdirSync } from 'fs';
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

// Copy example dashboard HTML into VitePress public so it deploys to GitHub Pages
copyFileRelative('example/robot_dashboard.html', 'docs/public/example/robot_dashboard.html');

// Copy only HTML files from Robot Framework outputs into VitePress public
copyHtmlOnly('tests/robot/resources/outputs', 'docs/public/tests/e2e/resources/outputs');
