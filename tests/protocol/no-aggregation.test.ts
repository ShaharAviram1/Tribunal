// The three opinions are never combined, and advocate positions are never summed
// (problem.md section 3 item 4 and section 4; CLAUDE.md; judicial-opinion.schema.md section 3).
// Nothing in the stored outputs or the job row may carry an aggregate under any name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runDeliberation } from '../../src/protocol/run.ts';
import { readJson, readText, ADVOCATE_IDS, JUDGE_IDS } from './_fixtures.ts';
import { makeClient, makeStore, allKeys, type ScriptedResponse } from './_fakes.ts';

const FORBIDDEN = ['majority', 'consensus', 'final', 'combined', 'aggregate', 'tally', 'count'];
// Names in ids, keys, or labels that would impersonate a real jurist (the dossier adapts, it does not impersonate).
const JURISTS = ['barak', 'elon', 'shamgar'];

const chargeSheet = readJson<Record<string, unknown>>('charge-sheets', 'T-001.stored.json');
const ok = (text: string): ScriptedResponse => ({ outcome: 'ok', text });

async function completed() {
  const stanceText = readText('stances', 'greyworm.emitted.json');
  const opinionText = readText('opinions', 'judge-3.emitted.json');
  const script: Record<string, ScriptedResponse[]> = {};
  for (const r of ADVOCATE_IDS) script[r] = [ok(stanceText)];
  for (const r of JUDGE_IDS) script[r] = [ok(opinionText)];
  const client = makeClient(script);
  const store = makeStore();
  let returned: unknown;
  try {
    returned = await runDeliberation({ client, store, chargeSheet: chargeSheet as never, deliberation_id: 'd-0001' });
  } catch (err) {
    returned = err;
  }
  return { client, store, returned };
}

const offending = (keys: string[]) =>
  keys.filter((k) => FORBIDDEN.some((w) => k.toLowerCase().includes(w)));

test('the job row has no field whose name suggests an aggregate of verdicts or positions', async () => {
  const { store } = await completed();
  const job = store.getJob();
  assert.ok(job !== undefined);
  assert.deepEqual(offending(allKeys(job)), [], `job carries aggregate-looking fields: ${JSON.stringify(job)}`);
  for (const j of store.jobs) assert.deepEqual(offending(allKeys(j)), [], 'an intermediate job write carries an aggregate-looking field');
});

test('no stored output has a field whose name suggests an aggregate, and none refers to another judge', async () => {
  const { store } = await completed();
  for (const [role_id, out] of store.outputs) {
    assert.deepEqual(offending(allKeys(out)), [], `${role_id} carries an aggregate-looking field`);
    const keys = allKeys(out);
    for (const other of JUDGE_IDS.filter((j) => j !== role_id)) {
      assert.ok(!keys.includes(other), `${role_id} has a key naming ${other}`);
    }
  }
});

test('whatever runDeliberation returns carries no aggregate-looking field either', async () => {
  const { returned } = await completed();
  if (returned instanceof Error) return;
  assert.deepEqual(offending(allKeys(returned)), [], JSON.stringify(returned));
});

test('no jurist name appears in any id or key of any stored output', async () => {
  const { store } = await completed();
  for (const [role_id, out] of store.outputs) {
    const o = out as { role_id: string; points?: Array<{ id: string }> };
    const ids = [o.role_id, ...(o.points?.map((p) => p.id) ?? [])];
    for (const id of ids) for (const name of JURISTS) assert.ok(!id.toLowerCase().includes(name), `${role_id}: id ${id} names a jurist`);
    for (const k of allKeys(out)) for (const name of JURISTS) assert.ok(!k.toLowerCase().includes(name), `${role_id}: key ${k} names a jurist`);
  }
  assert.deepEqual(JUDGE_IDS, ['judge-1', 'judge-2', 'judge-3']);
});

test('the stored opinions are three separate objects, each with its own verdict, none summarised', async () => {
  const { store } = await completed();
  const opinions = JUDGE_IDS.map((r) => store.getOutput(r) as { verdict: string });
  assert.equal(opinions.length, 3);
  for (const o of opinions) assert.ok(['justified', 'not_justified'].includes(o.verdict));
  // The store holds exactly the seven role outputs and nothing under any other key.
  assert.deepEqual([...store.outputs.keys()].sort(), [...ADVOCATE_IDS, ...JUDGE_IDS].sort());
});
