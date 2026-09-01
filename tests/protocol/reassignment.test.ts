// Role fallback: a seat that fails all its retries is reassigned to its configured fallback and
// re-run; the reassignment lands on the job map and the stored output. Never for content.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runDeliberation, type ModelClient, type CallOutcome } from '../../src/protocol/run.ts';
import { makeStore } from './_fakes.ts';

const chargeSheet = JSON.parse(readFileSync('fixtures/charge-sheets/T-001.stored.json', 'utf8'));
const stanceText = JSON.stringify(JSON.parse(readFileSync('fixtures/stances/greyworm.emitted.json', 'utf8')));
const opinionText = JSON.stringify(JSON.parse(readFileSync('fixtures/opinions/judge-3.emitted.json', 'utf8')));
const caps = { max_output_tokens: 1000, truncation_retry_ceiling_multiplier: 2 };

function fallbackClient(script: Record<string, CallOutcome[]>, fallbacks: Record<string, string[]>, primaries: Record<string, string>) {
  const log: { role_id: string; model: string }[] = [];
  const models = { ...primaries };
  const reassigns: string[] = [];
  return {
    log, reassigns, models,
    async call(req) {
      log.push({ role_id: req.role_id, model: models[req.role_id]! });
      const next = script[req.role_id]?.shift();
      if (!next) throw new Error(`no script for ${req.role_id}`);
      return { ...next, row: { model_requested: models[req.role_id]! } } as CallOutcome;
    },
    reassignToFallback(role_id: string) {
      const next = (fallbacks[role_id] ?? []).shift() ?? null;
      if (next) { models[role_id] = next; reassigns.push(role_id + '->' + next); }
      return next;
    },
  } as ModelClient & { log: typeof log; reassigns: string[]; models: typeof models };
}
const primaries = { jon: 'a/x', tyrion: 'a/x', daenerys: 'a/x', greyworm: 'a/x', 'judge-1': 'a/x', 'judge-2': 'a/x', 'judge-3': 'q/dead' };
const happy = () => ({ jon: [ok()], tyrion: [ok()], daenerys: [ok()], greyworm: [ok()], 'judge-1': [okO()], 'judge-2': [okO()], 'judge-3': [okO()] });
const ok = (): CallOutcome => ({ outcome: 'ok', text: stanceText });
const okO = (): CallOutcome => ({ outcome: 'ok', text: opinionText });
const dead = (): CallOutcome => ({ outcome: 'transport_error' });

test('a judge whose model never answers is reassigned to its fallback, visibly', async () => {
  const script = happy();
  script['judge-3'] = [dead(), okO()];
  const store = makeStore();
  const client = fallbackClient(script, { 'judge-3': ['c/backup'] }, { ...primaries });
  const job = await runDeliberation({ client, store, chargeSheet, deliberation_id: 'd-f', models: { ...primaries }, caps });
  assert.equal(job.status, 'complete');
  assert.deepEqual(client.reassigns, ['judge-3->c/backup']);
  const o = store.getOutput('judge-3') as { model_reassigned_from?: string };
  assert.equal(o.model_reassigned_from, 'q/dead', 'the reassignment is on the stored record');
  assert.equal(job.models['judge-3'], 'c/backup', 'the job map records the model that served');
});

test('an advocate exhausting three attempts is reassigned and the fallback pass gets fresh retries', async () => {
  const bad: CallOutcome = { outcome: 'ok', text: 'not json at all' };
  const script = happy();
  script.jon = [bad, bad, bad, bad, ok()];
  const store = makeStore();
  const client = fallbackClient(script, { jon: ['b/backup'] }, { ...primaries });
  const job = await runDeliberation({ client, store, chargeSheet, deliberation_id: 'd-f', models: { ...primaries }, caps });
  assert.equal(job.status, 'complete');
  assert.equal(client.log.filter((c) => c.role_id === 'jon').length, 5, 'three on primary, two on fallback');
  assert.equal(client.log.filter((c) => c.role_id === 'jon' && c.model === 'b/backup').length, 2);
  const o = store.getOutput('jon') as { model_reassigned_from?: string };
  assert.equal(o.model_reassigned_from, 'a/x');
});

test('a fallback that also fails leaves an honest failure record and no reassignment on success paths', async () => {
  const script = happy();
  script['judge-3'] = [dead(), dead()];
  const store = makeStore();
  const client = fallbackClient(script, { 'judge-3': ['c/backup'] }, { ...primaries });
  const job = await runDeliberation({ client, store, chargeSheet, deliberation_id: 'd-f', models: { ...primaries }, caps });
  assert.equal(job.status, 'incomplete');
  const rec = store.getOutput('judge-3') as { failed: boolean; attempts: unknown[] };
  assert.equal(rec.failed, true);
  assert.equal(rec.attempts.length, 2, 'attempts across both models are on the record');
});

test('a role that succeeds is never reassigned: content is not a reason', async () => {
  const store = makeStore();
  const client = fallbackClient(happy(), { jon: ['b/backup'], tyrion: ['b/backup'] }, { ...primaries });
  await runDeliberation({ client, store, chargeSheet, deliberation_id: 'd-f', models: { ...primaries }, caps });
  assert.deepEqual(client.reassigns, []);
});

test('a refused role is terminal: no fallback pass, no second model in its attempt history', async () => {
  const script = happy();
  script['judge-3'] = [{ outcome: 'refusal' } as CallOutcome];
  const store = makeStore();
  const client = fallbackClient(script, { 'judge-3': ['c/backup'] }, { ...primaries });
  const job = await runDeliberation({ client, store, chargeSheet, deliberation_id: 'd-f', models: { ...primaries }, caps });
  assert.equal(job.status, 'incomplete');
  assert.deepEqual(client.reassigns, [], 'a refusal never reaches the fallback');
  const rows = client.log.filter((c) => c.role_id === 'judge-3');
  assert.equal(rows.length, 1, 'zero retries after a refusal');
  assert.deepEqual([...new Set(rows.map((c) => c.model))], ['q/dead'], 'one model only in the attempt history');
  const rec = store.getOutput('judge-3') as { failed?: boolean; reason?: string; model_reassigned_from?: string };
  assert.equal(rec.failed, true);
  assert.equal(rec.reason, 'refusal');
  assert.equal(rec.model_reassigned_from, undefined, 'no reassignment on the record');
});
