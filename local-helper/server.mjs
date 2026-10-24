import * as c4 from './c4-provider.mjs';
import * as c5 from './c5-provider.mjs';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(root, '../dist');
const origin = 'http://127.0.0.1:4186';
const code = randomBytes(18).toString('hex');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mp4': 'video/mp4', '.otf': 'font/otf' };

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function same(a, b) {
  return typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b)
    && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

async function body(req, limit = 1_048_576) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('Request too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function sendBinary(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.headers.host !== '127.0.0.1:4186') return json(res, 403, { error: 'Invalid host' });
    const url = new URL(req.url, origin);
    if (req.headers.origin && req.headers.origin !== origin) return json(res, 403, { error: 'Cross-origin request denied' });

    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true });
    if (req.method === 'GET' && url.pathname === '/api/status') return json(res, 200, { code });
    if (req.method === 'GET' && url.pathname === '/api/c4/status') return json(res, 200, c4.getStatus());
    if (req.method === 'GET' && url.pathname === '/api/c5/status') return json(res, 200, c5.getStatus());

    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'POST' || !same(req.headers['x-five-key'], code)) {
        return json(res, 403, { error: 'Local session required' });
      }
      if (url.pathname === '/api/c4/play') return json(res, 200, await c4.getPlaylist());
      if (url.pathname === '/api/c5/play') return json(res, 200, await c5.getPlaylist());
      const c4Licence = url.pathname.match(/^\/api\/c4\/licence\/([a-f0-9]{32})$/);
      if (c4Licence) return sendBinary(res, await c4.getLicence(c4Licence[1], await body(req)));
      const c5Licence = url.pathname.match(/^\/api\/c5\/licence\/([a-f0-9]{32})$/);
      if (c5Licence) return sendBinary(res, await c5.getLicence(c5Licence[1], await body(req)));
      return json(res, 404, { error: 'Unknown endpoint' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const helperAsset = new Map([['/c4-client.js', resolve(root, 'c4-client.js')], ['/c5-client.js', resolve(root, 'c5-client.js')]]).get(url.pathname);
    const file = helperAsset || resolve(webRoot, `.${relative}`);
    if (!helperAsset && !file.startsWith(`${webRoot}/`)) return json(res, 404, { error: 'Not found' });
    let content = await readFile(file);
    if (url.pathname === '/' || url.pathname === '/index.html') {
      content = Buffer.from(content.toString().replace('</body>', '<script src="/c4-client.js"></script><script src="/c5-client.js"></script></body>'));
    }
    if (url.pathname === '/app.js') {
      const hook = 'if(!started){reveal();return}';
      const source = content.toString();
      if (!source.includes(hook)) throw new Error('Player integration point changed');
      content = Buffer.from(source.replace(hook, `${hook}if(index===3&&!sample&&window.FiveC4){window.FiveC4.tune(token);return}if(index===4&&!sample&&window.FiveC5){window.FiveC5.tune(token);return}`));
    }
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof URIError) return json(res, 404, { error: 'Not found' });
    const message = /Channel 4|Channel 5|Unexpected/.test(error.message) ? error.message : 'Provider request failed or timed out';
    json(res, error.status || 502, { error: message });
  }
});

server.listen(4186, '127.0.0.1', () => {
  console.log(`Five local helper listening at ${origin}`);
  console.log('Keep this process running and use scripts/connect-fire-tv.sh to restore the Fire TV tunnel after disconnects.');
});
