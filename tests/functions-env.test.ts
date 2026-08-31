import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const VARS = ['TRIBUNAL_ACCESS_CODE', 'TRIBUNAL_FUNCTION_SECRET', 'TRIBUNAL_STORE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENROUTER_API_KEY'];
const saved: Record<string, string | undefined> = {};
for (const v of VARS) saved[v] = process.env[v];
beforeEach(() => { for (const v of VARS) delete process.env[v]; });

// The guard replaces fetch with a thrower, so if a function attempted any call, the test would
// fail with "reached the network" instead of the clean env error asserted here.
test('the filing function with an empty environment returns 500 naming every missing variable and makes no call', async () => {
  const { default: handler } = await import('../netlify/functions/tribunal-file.mts');
  const res = await handler(new Request('https://x/f', { method: 'POST' }));
  assert.equal(res.status, 500);
  const body = await res.json() as { error: string; missing: string[] };
  assert.match(body.error, /no model call/);
  for (const v of ['TRIBUNAL_FUNCTION_SECRET', 'TRIBUNAL_STORE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    assert.ok(body.missing.includes(v), `missing list lacks ${v}`);
  }
});

test('the background function with an empty environment returns 500 naming every missing variable and makes no call', async () => {
  const { default: handler } = await import('../netlify/functions/tribunal-run-background.mts');
  const res = await handler(new Request('https://x/f', { method: 'POST' }));
  assert.equal(res.status, 500);
  const body = await res.json() as { missing: string[] };
  for (const v of ['TRIBUNAL_FUNCTION_SECRET', 'TRIBUNAL_STORE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENROUTER_API_KEY']) {
    assert.ok(body.missing.includes(v), `missing list lacks ${v}`);
  }
});

test('TRIBUNAL_STORE=file is refused by a function: the filesystem vanishes with the invocation', async () => {
  for (const v of VARS) process.env[v] = 'set';
  process.env.TRIBUNAL_STORE = 'file';
  const { default: handler } = await import('../netlify/functions/tribunal-run-background.mts');
  const res = await handler(new Request('https://x/f', { method: 'POST' }));
  assert.equal(res.status, 500);
  const body = await res.json() as { wrong: string[] };
  assert.match(body.wrong[0]!, /vanishes with the invocation/);
  for (const v of VARS) { if (saved[v] === undefined) delete process.env[v]; else process.env[v] = saved[v]; }
});
