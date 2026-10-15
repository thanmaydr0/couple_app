import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { build, root } from './build.mjs';
await build();
const directory = resolve(root, 'dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (process.argv.includes('--qa') && pathname === '/qa.html') {
      const page = (await readFile(resolve(directory, 'index.html'), 'utf8')).replace('<script type="module"', '<script src="/qa-backend.js"></script><script type="module"');
      response.setHeader('Content-Type', mime['.html']); response.end(page); return;
    }
    if (process.argv.includes('--qa') && pathname === '/qa-backend.js') {
      response.setHeader('Content-Type', mime['.js']); response.end(await readFile(resolve(root, 'tests/qa-backend.js'))); return;
    }
    const file = resolve(directory, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(directory + sep)) { response.writeHead(403).end(); return; }
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404).end('Not found'); }
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Us web: http://127.0.0.1:${process.env.PORT || 4173}`));
