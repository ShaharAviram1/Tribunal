import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ModelClient, type Caps, type LogRow, type Transport, type Budget } from '../src/client/model-client.ts';

const caps: Caps = JSON.parse(readFileSync('config/caps.json', 'utf8'));
const models = { jon: 'test/model-a' };

function memBudget(): Budget & { rows: LogRow[] } {
  const rows: LogRow[] = [];
  return {
    rows,
    read: async () => ({ calls: rows.length, spend_usd: rows.reduce((s, r) => s + (r.cost_usd ?? 0), 0) }),
    add: async (r) => { rows.push(r); },
  };
}
const ok = (text = '{}', served = 'test/model-a', finish = 'stop'): Transport => async () => ({ kind: 'ok', text, model_served: served, tokens_in: 10, tokens_out: 5, cost_usd: 0.01, http_status: 200, temperature_honoured: null, finish_reason: finish });
const script = (kinds: Array<'ok' | 'transport_error' | 'refusal' | 'timeout'>): Transport => {
  let i = 0;
  return async () => {
    const k = kinds[Math.min(i++, kinds.length - 1)]!;
    if (k === 'ok') return { kind: 'ok', text: '{}', model_served: 'test/model-a', tokens_in: 1, tokens_out: 1, cost_usd: 0.001, http_status: 200, temperature_honoured: null, finish_reason: 'stop' };
    if (k === 'refusal') return { kind: 'refusal', model_served: 'test/model-a', http_status: 200, detail: 'content_filter' };
    if (k === 'timeout') return { kind: 'timeout' };
    return { kind: 'transport_error', http_status: 503, detail: 'upstream' };
  };
};
const mk = (transport: Transport, c: Partial<Caps> = {}, budget = memBudget()) =>
  ({ client: new ModelClient({ caps: { ...caps, ...c }, models, deliberation_id: 'd-test', budget, transport, sleep: async () => {}, random: () => 0, now: () => 0 }), budget });
const req = (attempt = 1) => ({ role_id: 'jon', prompt: 'p', hash: 'h'.repeat(64), attempt });

test('an ok call writes one row with requested and served model, hash, temperature, tokens, cost, latency, outcome', async () => {
  const { client } = mk(ok());
  const r = await client.call(req());
  assert.equal(r.outcome, 'ok');
  assert.equal(client.log.length, 1);
  const row = client.log[0]!;
  assert.equal(row.model_requested, 'test/model-a'); assert.equal(row.model_served, 'test/model-a'); assert.equal(row.model_mismatch, false);
  assert.equal(row.prompt_hash, 'h'.repeat(64)); assert.equal(row.temperature, 0);
  assert.equal(row.tokens_in, 10); assert.equal(row.tokens_out, 5); assert.equal(row.cost_usd, 0.01); assert.equal(typeof row.latency_ms, 'number');
});

test('a served model that differs from the requested one is logged as a mismatch', async () => {
  const { client } = mk(ok('{}', 'other/model'));
  await client.call(req());
  assert.equal(client.log[0]!.model_mismatch, true);
  assert.equal(client.log[0]!.model_served, 'other/model');
});

test('transport failures retry twice with a row per attempt, then report transport_error', async () => {
  const { client } = mk(script(['transport_error', 'timeout', 'transport_error']));
  const r = await client.call(req());
  assert.equal(r.outcome, 'transport_error');
  assert.deepEqual(client.log.map((x) => x.outcome), ['transport_error', 'timeout', 'transport_error']);
});

test('a transport failure followed by success returns ok with two rows', async () => {
  const { client } = mk(script(['transport_error', 'ok']));
  const r = await client.call(req());
  assert.equal(r.outcome, 'ok');
  assert.equal(client.log.length, 2);
});

test('a refusal returns immediately with one row and no transport retry', async () => {
  const { client } = mk(script(['refusal', 'ok']));
  const r = await client.call(req());
  assert.equal(r.outcome, 'refusal');
  assert.equal(client.log.length, 1);
});

test('the call cap refuses the next call and writes a cap_exceeded row', async () => {
  const { client } = mk(ok(), { max_calls_per_deliberation: 2 });
  await client.call(req(1)); await client.call(req(2));
  const r = await client.call(req(3));
  assert.equal(r.outcome, 'cap_exceeded');
  assert.equal(client.log.length, 3);
  assert.match(client.log[2]!.detail!, /call cap 2/);
});

test('the spend cap refuses the call that would follow reaching it', async () => {
  const { client } = mk(ok(), { max_spend_usd_per_deliberation: 0.02 });
  await client.call(req(1)); await client.call(req(2));
  const r = await client.call(req(3));
  assert.equal(r.outcome, 'cap_exceeded');
  assert.match(client.log[2]!.detail!, /spend cap/);
});

test('the per-role attempt ceiling refuses a fifth attempt', async () => {
  const { client } = mk(ok());
  const r = await client.call(req(5));
  assert.equal(r.outcome, 'cap_exceeded');
  assert.match(r.row.detail!, /per-role ceiling 4/);
});

test('budget is read from the job, not process memory: a fresh client sees prior spend', async () => {
  const budget = memBudget();
  const a = mk(ok(), { max_calls_per_deliberation: 2 }, budget);
  await a.client.call(req(1)); await a.client.call(req(2));
  const b = mk(ok(), { max_calls_per_deliberation: 2 }, budget);
  const r = await b.client.call(req(3));
  assert.equal(r.outcome, 'cap_exceeded');
  assert.equal(b.client.log.length, 1);
});

test('caps cannot be changed after construction', () => {
  const { client } = mk(ok());
  assert.throws(() => { (client.caps as any).max_calls_per_deliberation = 999; });
  assert.equal(client.caps.max_calls_per_deliberation, 20);
});

test('the row carries the ceiling sent and the finish reason; a length finish is reported as truncated', async () => {
  const { client } = mk(ok('{"a":', 'test/model-a', 'length'));
  const r = await client.call({ ...req(), max_output_tokens: 777 });
  assert.equal(r.outcome, 'ok'); if (r.outcome === 'ok') assert.equal(r.truncated, true);
  assert.equal(client.log[0]!.max_output_tokens, 777);
  assert.equal(client.log[0]!.finish_reason, 'length');
});
