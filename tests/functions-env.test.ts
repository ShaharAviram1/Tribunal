import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const VARS = ['TRIBUNAL_ACCESS_CODE', 'TRIBUNAL_FUNCTION_SECRET', 'TRIBUNAL_STORE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENROUTER_API_KEY', 'TRIBUNAL_PERSISTENT_HOST'];
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

// The persistent-host flag, added 2026-09-18 with the move to the owner's host. It is the only
// thing that makes TRIBUNAL_STORE=file legitimate, and it excuses nothing else.
test('with TRIBUNAL_PERSISTENT_HOST=1 the file store is accepted and the SUPABASE_* pair is not required', async () => {
  const { checkEnv, RUN_ENV } = await import('../src/functions-env.ts');
  process.env.TRIBUNAL_PERSISTENT_HOST = '1';
  process.env.TRIBUNAL_STORE = 'file';
  process.env.TRIBUNAL_FUNCTION_SECRET = 'set';
  process.env.OPENROUTER_API_KEY = 'set';
  assert.deepEqual(checkEnv(RUN_ENV), { ok: true });
});

test('with the flag set, a missing secret is still named and no model call is made', async () => {
  const { checkEnv, RUN_ENV } = await import('../src/functions-env.ts');
  process.env.TRIBUNAL_PERSISTENT_HOST = '1';
  process.env.TRIBUNAL_STORE = 'file';
  const out = checkEnv(RUN_ENV);
  assert.equal(out.ok, false);
  const body = await (out as { ok: false; response: Response }).response.json() as { missing: string[]; wrong: string[] };
  assert.deepEqual(body.missing, ['TRIBUNAL_FUNCTION_SECRET', 'OPENROUTER_API_KEY']);
  assert.deepEqual(body.wrong, []);
});

test('the flag does not accept a store that is neither file nor supabase', async () => {
  const { checkEnv } = await import('../src/functions-env.ts');
  process.env.TRIBUNAL_PERSISTENT_HOST = '1';
  process.env.TRIBUNAL_STORE = 'postgres';
  const out = checkEnv([]);
  assert.equal(out.ok, false);
  const body = await (out as { ok: false; response: Response }).response.json() as { wrong: string[] };
  assert.match(body.wrong[0]!, /must be "file" or "supabase"/);
});

test('without the flag the refusal of the file store is unchanged, whatever the flag is set to', async () => {
  const { checkEnv } = await import('../src/functions-env.ts');
  for (const flag of [undefined, '0', 'true', 'yes']) {
    if (flag === undefined) delete process.env.TRIBUNAL_PERSISTENT_HOST; else process.env.TRIBUNAL_PERSISTENT_HOST = flag;
    process.env.TRIBUNAL_STORE = 'file';
    const out = checkEnv([]);
    assert.equal(out.ok, false, `flag ${String(flag)}`);
    const body = await (out as { ok: false; response: Response }).response.json() as { wrong: string[] };
    assert.match(body.wrong[0]!, /vanishes with the invocation/);
  }
});
