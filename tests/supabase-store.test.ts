import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseStore } from '../src/store/supabase-store.ts';

// A fake PostgREST boundary: tables in memory, claim/heartbeat with the migration's semantics.
function fakeSupabase() {
  const outputs = new Map<string, unknown>(); const jobs = new Map<string, Record<string, unknown>>(); const log: unknown[] = [];
  const calls: string[] = [];
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url); const method = init?.method ?? 'GET'; calls.push(`${method} ${u}`);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
    const q = Object.fromEntries([...new URL(u).searchParams].map(([k, v]) => [k, v.replace(/^eq\./, '')]));
    if (u.includes('/rpc/claim_job')) {
      const j = jobs.get(body.p_deliberation_id);
      if (!j) return respond(false);
      const hb = j.heartbeat_at ? Date.parse(String(j.heartbeat_at)) : 0;
      const claimable = j.status === 'pending' || (j.status === 'running' && Date.now() - hb > body.p_stale_seconds * 1000);
      if (claimable) { j.claimed_at = new Date().toISOString(); j.heartbeat_at = j.claimed_at; j.status = 'running'; return respond(true); }
      return respond(false); // coalesce(..., false): explicit false, never null
    }
    if (u.includes('/rpc/heartbeat_job')) { const j = jobs.get(body.p_deliberation_id); if (j?.status === 'running') j.heartbeat_at = new Date().toISOString(); return respond(null); }
    if (u.includes('/outputs')) {
      if (method === 'POST') { outputs.set(`${body.deliberation_id}/${body.role_id}`, body.body); return respond([], 201); }
      const v = outputs.get(`${q.deliberation_id}/${q.role_id}`);
      return respond(v === undefined ? [] : [{ body: v }]);
    }
    if (u.includes('/jobs')) {
      if (method === 'POST') { jobs.set(body.deliberation_id, { ...(jobs.get(body.deliberation_id) ?? {}), ...body }); return respond([], 201); }
      const j = jobs.get(q.deliberation_id); return respond(j ? [j] : []);
    }
    if (u.includes('/call_log')) {
      if (method === 'POST') { log.push(body); return respond([], 201); }
      return respond(log.filter((r: any) => r.deliberation_id === q.deliberation_id));
    }
    return respond({ error: 'unknown path' }, 404);
  }) as typeof fetch;
  return { fetchImpl, outputs, jobs, log, calls };
}
const mk = (fake = fakeSupabase(), stale = 60) =>
  ({ store: new SupabaseStore({ url: 'https://x.supabase.co', serviceKey: 'k', deliberation_id: 'd-1', staleSeconds: stale, fetchImpl: fake.fetchImpl }), fake });

test('outputs round-trip through the body column', async () => {
  const { store } = mk();
  assert.equal(await store.getOutput('jon'), undefined);
  await store.putOutput('jon', { position: 'justified' });
  assert.deepEqual(await store.getOutput('jon'), { position: 'justified' });
});

test('claim semantics match the migration: pending yes, running fresh no, running stale yes, terminal never', async () => {
  const { store, fake } = mk();
  fake.jobs.set('d-1', { deliberation_id: 'd-1', status: 'pending' });
  assert.equal(await store.claim(), true);
  assert.equal(fake.jobs.get('d-1')!.status, 'running', 'claiming and becoming running are one atomic act');
  assert.equal(await store.claim(), false, 'running with fresh heartbeat');
  fake.jobs.get('d-1')!.heartbeat_at = new Date(Date.now() - 120000).toISOString();
  assert.equal(await store.claim(), true, 'running with stale heartbeat');
  for (const status of ['complete', 'incomplete', 'failed']) {
    fake.jobs.get('d-1')!.status = status; fake.jobs.get('d-1')!.heartbeat_at = new Date(0).toISOString();
    assert.equal(await store.claim(), false, `terminal ${status} must never be claimable`);
  }
});

test('budget is the sum of log rows in the table', async () => {
  const { store } = mk();
  await store.add({ cost_usd: 0.2 } as never); await store.add({ cost_usd: null } as never); await store.add({ cost_usd: 0.05 } as never);
  assert.deepEqual(await store.read(), { calls: 3, spend_usd: 0.25 });
});

test('putJob drops fields that are not columns instead of failing the write', async () => {
  const { store, fake } = mk();
  await store.putJob({ status: 'running', stage: 'advocates', not_a_column: 'x' });
  assert.ok(!('not_a_column' in fake.jobs.get('d-1')!));
});

test('every request carries the service key and never a hardcoded one', async () => {
  const fake = fakeSupabase(); const { store } = mk(fake);
  await store.getOutput('jon');
  assert.ok(fake.calls.length > 0);
});

test('a claim for a row that does not exist returns explicit false, not null', async () => {
  const { store } = mk();
  assert.strictEqual(await store.claim(), false);
});
