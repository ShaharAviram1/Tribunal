import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runDeliberation, type ModelClient, type CallOutcome } from '../../src/protocol/run.ts';
import { readJson, readText } from './_fixtures.ts';
import { makeStore } from './_fakes.ts';

const chargeSheet = readJson('charge-sheets', 'T-001.stored.json');
const stanceText = JSON.stringify(readJson('stances', 'greyworm.emitted.json'));
const opinionText = JSON.stringify(readJson('opinions', 'judge-3.emitted.json'));
const cut = stanceText.slice(0, 120);

// A client that records the ceiling it was asked for and scripts truncation per role.
function client(script: Record<string, CallOutcome[]>): ModelClient & { ceilings: Record<string, number[]>; prompts: Record<string, string[]> } {
  const ceilings: Record<string, number[]> = {}; const prompts: Record<string, string[]> = {}; const log: unknown[] = [];
  return {
    log, ceilings, prompts,
    async call(req) {
      (ceilings[req.role_id] ??= []).push(req.max_output_tokens ?? -1);
      (prompts[req.role_id] ??= []).push(req.prompt);
      log.push({ role_id: req.role_id });
      const next = script[req.role_id]?.shift();
      if (!next) throw new Error(`no script for ${req.role_id}`);
      return next;
    },
  };
}
const ok = (text: string): CallOutcome => ({ outcome: 'ok', text });
const truncated = (text: string): CallOutcome => ({ outcome: 'ok', text, truncated: true });
const happy = () => ({ jon: [ok(stanceText)], tyrion: [ok(stanceText)], daenerys: [ok(stanceText)], greyworm: [ok(stanceText)], 'judge-1': [ok(opinionText)], 'judge-2': [ok(opinionText)], 'judge-3': [ok(opinionText)] });
const caps = { max_output_tokens: 1000, truncation_retry_ceiling_multiplier: 2 };

test('truncation: one retry of the same prompt at a doubled ceiling, no corrective text', async () => {
  const s = happy(); s.tyrion = [truncated(cut), ok(stanceText)];
  const c = client(s); const store = makeStore();
  const job = await runDeliberation({ client: c, store, chargeSheet: chargeSheet as never, deliberation_id: 'd-t', caps });
  assert.deepEqual(c.ceilings.tyrion, [1000, 2000]);
  assert.equal(c.prompts.tyrion![0], c.prompts.tyrion![1], 'same prompt, no corrective block');
  assert.equal(job.status, 'complete');
});

test('truncation on every allowed attempt fails the role as truncated with all raw texts stored', async () => {
  const s = happy(); s.tyrion = [truncated(cut), truncated(cut + 'x'), truncated(cut + 'y')];
  const c = client(s); const store = makeStore();
  const job = await runDeliberation({ client: c, store, chargeSheet: chargeSheet as never, deliberation_id: 'd-t', caps });
  const rec = store.getOutput('tyrion') as { failed: boolean; reason: string; attempts: { text: string; detail: string }[] };
  assert.equal(rec.failed, true);
  assert.match(rec.reason, /truncated/);
  assert.deepEqual(rec.attempts.map((a) => a.text), [cut, cut + 'x', cut + 'y']);
  assert.match(rec.attempts[0]!.detail, /1000/); assert.match(rec.attempts[1]!.detail, /2000/); assert.match(rec.attempts[2]!.detail, /4000/);
  assert.equal(job.status, 'incomplete');
});

test('a non-truncated malformed response still gets the corrective block, at the base ceiling', async () => {
  const s = happy(); s.jon = [ok(readText('stances', 'invalid', 'not-json.txt')), ok(stanceText)];
  const c = client(s);
  await runDeliberation({ client: c, store: makeStore(), chargeSheet: chargeSheet as never, deliberation_id: 'd-t', caps });
  assert.deepEqual(c.ceilings.jon, [1000, 1000]);
  assert.notEqual(c.prompts.jon![0], c.prompts.jon![1]);
});
