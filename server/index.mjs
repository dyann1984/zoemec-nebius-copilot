import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { route } from './handler.mjs';

const dist = fileURLToPath(new URL('../dist', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 10000) return null; chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return null; }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const body = req.method === 'POST' ? await readBody(req) : undefined;
      const result = req.method === 'POST' && body === null
        ? { status: 400, body: { ok: false, code: 'INVALID_REQUEST', error: 'Invalid request body.' } }
        : await route({ method: req.method, path: url.pathname, body, ip: req.socket.remoteAddress });
      res.writeHead(result.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(result.body));
    }
    let file = normalize(join(dist, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!file.startsWith(dist)) { res.writeHead(403); return res.end(); }
    try { if (!(await stat(file)).isFile()) throw new Error(); } catch { file = join(dist, 'index.html'); }
    try {
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(await readFile(file));
    } catch { res.writeHead(404); res.end('Run "npm run build" first.'); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8787);
  createServer().listen(port, () => console.log(`ZOEMEC Nebius copilot listening on http://localhost:${port}`));
}
