// The plain Node host routes exactly as netlify.toml does. Loopback only; the guard's fetch block
// stands, and every handler answers before it would reach Supabase because the store env is unset.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { start } from '../server/serve.ts';
import type { Server } from 'node:http';

let server: Server; let port: number;
before(async () => {
  for (const k of ['TRIBUNAL_STORE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TRIBUNAL_FUNCTION_SECRET']) delete process.env[k];
  server = start(0);
  await new Promise<void>((r) => server.once('listening', r));
  port = (server.address() as { port: number }).port;
});
after(() => server.close());

const call = (method: string, path: string, headers: Record<string, string> = {}, body?: string) => new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; text: string }>((resolve, reject) => {
  const req = httpRequest({ host: '127.0.0.1', port, method, path, headers }, (res) => {
    const chunks: Buffer[] = [];
    res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, text: Buffer.concat(chunks).toString() }));
  });
  req.on('error', reject); if (body) req.write(body); req.end();
});

test('the front door is public/index.html', async () => {
  const r = await call('GET', '/');
  assert.equal(r.status, 200);
  assert.match(String(r.headers['content-type']), /text\/html/);
  assert.ok(r.text.includes('The matter before the bench'));
});

test('a static file answers a byte range, as the gavel clip is fetched', async () => {
  const r = await call('GET', '/case-ui.js', { Range: 'bytes=0-9' });
  assert.equal(r.status, 206);
  assert.equal(r.text.length, 10);
  assert.match(String(r.headers['content-range']), /^bytes 0-9\/\d+$/);
});

test('nothing outside public/ is reachable as a file', async () => {
  for (const p of ['/../.env', '/..%2F.env', '/../package.json', '/prompts/_intake.md']) assert.equal((await call('GET', p)).status, 404, p);
});

test('a function path reaches the real handler, and only the five names exist', async () => {
  const r = await call('GET', '/.netlify/functions/tribunal-file');
  assert.equal(r.status, 405, 'the filing handler answers its own 405 to GET');
  assert.deepEqual(JSON.parse(r.text), { error: 'POST only' });
  assert.equal((await call('GET', '/.netlify/functions/tribunal-nothing')).status, 404);
});

test('a missing environment fails loudly through the adapter, with nothing substituted', async () => {
  const r = await call('POST', '/.netlify/functions/tribunal-file?panel=single', { 'Content-Type': 'application/json' }, '{}');
  assert.equal(r.status, 500);
  const body = JSON.parse(r.text);
  assert.equal(body.error, 'environment invalid; no model call was made');
  assert.ok(body.missing.includes('SUPABASE_URL'));
});

test('/case/<id> reaches the case page handler with the id, as the redirect does', async () => {
  const r = await call('GET', '/case/d-T-001-1');
  assert.equal(r.status, 500, 'the case page handler ran and reported the unset store env');
  assert.equal(JSON.parse(r.text).error, 'environment invalid; no model call was made');
  const bad = await call('GET', '/case/not-a-deliberation');
  assert.equal(bad.status, 500, 'the id check sits behind the env check in the handler itself');
});

test('the background function answers 202 at once, as on Netlify', async () => {
  const t0 = Date.now();
  const r = await call('POST', '/.netlify/functions/tribunal-run-background', { 'Content-Type': 'application/json' }, '{}');
  assert.equal(r.status, 202);
  assert.ok(Date.now() - t0 < 2000);
});

test('the retired intake endpoint answers 503 through the adapter', async () => {
  const r = await call('POST', '/.netlify/functions/tribunal-intake', { 'Content-Type': 'application/json' }, '{"scenario":"x"}');
  assert.equal(r.status, 503);
  assert.match(JSON.parse(r.text).error, /retired/);
});
