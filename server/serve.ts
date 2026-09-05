// A plain Node server that hosts the same five handlers Netlify does, on the same paths, so the
// site can run anywhere Node 24 runs: a Render web service, or a laptop. It exists because the
// Netlify deploy stopped on 2026-09-05 (credits exhausted), not because anything in the handlers
// changed. Nothing here reasons, stores, or renders; it routes, and it turns Node's request
// objects into the web-standard Request each handler already takes.
//
// Parity with netlify.toml, claim by claim:
//   - `public/` is served as static files, `index.html` at `/`.
//   - `/.netlify/functions/<name>` reaches `netlify/functions/<name>.mts`, five names, no others.
//   - `/case/<id>` reaches the case page with `deliberation_id=<id>`, as the redirect does.
//   - The background function answers 202 at once and keeps running, as Netlify's does. One
//     difference stands and is recorded in ARCHITECTURE.md: nothing re-invokes it after a crash.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

type Handler = (req: Request) => Promise<Response>;
const FUNCTIONS = ['tribunal-file', 'tribunal-intake', 'tribunal-case', 'tribunal-case-page', 'tribunal-run-background'] as const;
const BACKGROUND = 'tribunal-run-background';
const PUBLIC = join(process.cwd(), 'public');
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mp4': 'video/mp4', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

const handlers = new Map<string, Promise<Handler>>();
const handler = (name: string): Promise<Handler> => {
  if (!handlers.has(name)) handlers.set(name, import(`../netlify/functions/${name}.mts`).then((m) => m.default as Handler));
  return handlers.get(name)!;
};

async function toRequest(req: IncomingMessage): Promise<Request> {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() ?? 'http';
  const host = req.headers.host ?? 'localhost';
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v); else if (Array.isArray(v)) headers.set(k, v.join(', '));
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks);
  return new Request(`${proto}://${host}${req.url ?? '/'}`, { method: req.method, headers, body });
}

async function send(res: ServerResponse, out: Response): Promise<void> {
  const headers: Record<string, string> = {};
  out.headers.forEach((v, k) => { headers[k] = v; });
  res.writeHead(out.status, headers);
  res.end(Buffer.from(await out.arrayBuffer()));
}

function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
  const rel = normalize(decodeURIComponent(pathname === '/' ? '/index.html' : pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) return false;
  let st; try { st = statSync(file); } catch { return false; }
  if (!st.isFile()) return false;
  const type = TYPES[extname(file)] ?? 'application/octet-stream';
  // Single byte ranges, because the gavel clip is fetched with them and a media fragment seeks.
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return true; }
    res.writeHead(206, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes' });
    createReadStream(file, { start, end }).pipe(res);
    return true;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
  if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
  return true;
}

export async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://x');
  const fn = /^\/\.netlify\/functions\/([a-z-]+)\/?$/.exec(url.pathname);
  const caseMatch = /^\/case\/([^/]+)$/.exec(url.pathname);
  try {
    if (fn) {
      const name = fn[1]!;
      if (!(FUNCTIONS as readonly string[]).includes(name)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end(`no function named ${name}`); return; }
      const h = await handler(name);
      const request = await toRequest(req);
      if (name === BACKGROUND) {
        // Netlify's background functions answer 202 before running; the same here, in-process.
        h(request).then(async (r) => console.log(`[background] ${r.status} ${await r.text()}`), (e) => console.error('[background] threw', e));
        res.writeHead(202); res.end();
        return;
      }
      await send(res, await h(request));
      return;
    }
    if (caseMatch) {
      const h = await handler('tribunal-case-page');
      const request = await toRequest(req);
      const u = new URL(request.url);
      u.searchParams.set('deliberation_id', decodeURIComponent(caseMatch[1]!));
      await send(res, await h(new Request(u, request)));
      return;
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && serveStatic(req, res, url.pathname)) return;
    res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found');
  } catch (e) {
    console.error(`[server] ${req.method} ${req.url} threw`, e);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'the server threw; nothing was substituted', detail: String((e as Error)?.message ?? e) }));
  }
}

export function start(port: number): ReturnType<typeof createServer> {
  const server = createServer((req, res) => { void route(req, res); });
  server.listen(port, () => console.log(`[server] listening on ${port}, serving ${PUBLIC}`));
  return server;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  start(Number(process.env.PORT ?? 8888));
}
