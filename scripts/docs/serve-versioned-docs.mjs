// Serve docs/.vitepress/dist the way GitHub Pages does: under the
// /robotframework-dashboard/ prefix, so the version switcher, banner links and
// the shared root assets resolve exactly like on the live site.
//
// Usage: node scripts/docs/serve-versioned-docs.mjs [--port 4173]
// (run scripts/docs/build-versioned-docs.mjs first)

import { createReadStream, existsSync, statSync } from 'fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_BASE = '/robotframework-dashboard/';
const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/.vitepress/dist');
const port = Number(process.argv[process.argv.indexOf('--port') + 1]) || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
};

if (!existsSync(distDir)) {
  console.error(`${distDir} not found: run "npm run docs:build:versions" first`);
  process.exit(1);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (!url.pathname.startsWith(SITE_BASE)) {
    res.writeHead(302, { Location: SITE_BASE });
    return res.end();
  }
  let file = normalize(join(distDir, decodeURIComponent(url.pathname.slice(SITE_BASE.length))));
  if (!file.startsWith(distDir + sep) && file !== distDir) {
    res.writeHead(403);
    return res.end();
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end(`404 ${url.pathname}`);
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`port ${port} is already in use: stop the other server or pass --port <number>`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, () => {
  console.log(`versioned docs: http://localhost:${port}${SITE_BASE}`);
});
