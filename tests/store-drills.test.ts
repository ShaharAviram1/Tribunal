// The idempotency drills run against BOTH store implementations, so the interface, not an
// implementation, is what is tested (turn two plan, step 7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileStore } from '../src/store/file-store.ts';
import { SupabaseStore } from '../src/store/supabase-store.ts';
import { runDeliberation, type ModelClient, type Store, type CallOutcome } from '../src/protocol/run.ts';

const chargeSheet = JSON.parse(readFileSync('fixtures/charge-sheets/T-001.stored.json', 'utf8'));
const stanceText = JSON.stringify(JSON.parse(readFileSync('fixtures/stances/greyworm.emitted.json', 'utf8')));
const opinionText = JSON.stringify(JSON.parse(readFileSync('fixtures/opinions/judge-3.emitted.json', 'utf8')));

function scriptedClient(): ModelClient & { count: () => number } {
  const log: unknown[] = [];
  return {
    log, count: () => log.length,
    async call(req) {
      log.push({ role_id: req.role_id, cost_usd: 0.01 });
      const text = req.role_id.startsWith('judge') ? opinionText : stanceText;
      return { outcome: 'ok', text } as CallOutcome;
    },
  };
}

// Minimal in-memory PostgREST fake reused from supabase-store.test.ts semantics.
function fakeSupabaseStore(id: string): SupabaseStore {
  const outputs = new Map<string, unknown>(); const jobs = new Map<string, Record<string, unknown>>(); const log: unknown[] = [];
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url); const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
    const q = Object.fromEntries([...new URL(u).searchParams].map(([k, v]) => [k, v.replace(/^eq\./, '')]));
    if (u.includes('/rpc/claim_job')) {
      const j = jobs.get(body.p_deliberation_id) ?? jobs.set(body.p_deliberation_id, { status: 'pending' }).get(body.p_deliberation_id)!;
      const hb = j.heartbeat_at ? Date.parse(String(j.heartbeat_at)) : 0;
      const okc = j.status === 'pending' || j.status === undefined || (j.status === 'running' && Date.now() - hb > body.p_stale_seconds * 1000);
      if (okc) { j.heartbeat_at = new Date().toISOString(); return respond(true); }
      return respond(null);
    }
    if (u.includes('/rpc/heartbeat_job')) return respond(null);
    if (u.includes('/outputs')) {
      if (method === 'POST') { outputs.set(body.role_id, body.body); return respond([], 201); }
      const v = outputs.get(q.role_id); return respond(v === undefined ? [] : [{ body: v }]);
    }
    if (u.includes('/jobs')) {
      if (method === 'POST') { jobs.set(body.deliberation_id, { ...(jobs.get(body.deliberation_id) ?? {}), ...body }); return respond([], 201); }
      const j = jobs.get(q.deliberation_id); return respond(j ? [j] : []);
    }
    if (u.includes('/call_log')) { if (method === 'POST') { log.push(body); return respond([], 201); } return respond(log); }
    return respond({}, 404);
  }) as typeof fetch;
  return new SupabaseStore({ url: 'https://x.supabase.co', serviceKey: 'k', deliberation_id: id, staleSeconds: 60, fetchImpl });
}

const implementations: [string, () => Store][] = [
  ['FileStore', () => new FileStore(mkdtempSync(join(tmpdir(), 'tribunal-drill-')), 'd-drill')],
  ['SupabaseStore', () => fakeSupabaseStore('d-drill')],
];

for (const [name, make] of implementations) {
  test(`${name}: a second invocation after completion makes zero model calls`, async () => {
    const store = make();
    const c1 = scriptedClient();
    const first = await runDeliberation({ client: c1, store, chargeSheet, deliberation_id: 'd-drill' });
    assert.equal(first.status, 'complete');
    assert.equal(c1.count(), 7);
    const c2 = scriptedClient();
    const second = await runDeliberation({ client: c2, store, chargeSheet, deliberation_id: 'd-drill' });
    assert.equal(c2.count(), 0, 'terminal job re-run made model calls');
    assert.equal(second.status, 'complete');
  });

  test(`${name}: re-entry with four stances stored calls only the judges`, async () => {
    const store = make();
    const c1 = scriptedClient();
    // First pass: advocates only, then pretend the function died before the judge stage.
    for (const r of ['jon', 'tyrion', 'daenerys', 'greyworm']) {
      const res = await c1.call({ role_id: r, prompt: 'p', hash: 'h'.repeat(64), attempt: 1 });
      if (res.outcome === 'ok') {
        const stance = JSON.parse(res.text);
        await store.putOutput(r, { role_id: r, seat: 'defense', deliberation_id: 'd-drill', position: stance.position, points: stance.points.map((p: object, i: number) => ({ id: `${r}.p${i + 1}`, ...p })) });
      }
    }
    const c2 = scriptedClient();
    const job = await runDeliberation({ client: c2, store, chargeSheet, deliberation_id: 'd-drill' });
    assert.equal(c2.count(), 3, 're-entry called advocates again');
    assert.equal(job.status, 'complete');
  });
}
