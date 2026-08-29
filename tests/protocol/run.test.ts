// The deliberation protocol, derived from spec.md (part two criteria 6, 7, 14, 15; part three; part five),
// prompts/_contract.md (assembly order, corrective block), and the two output schemas (section 3 / 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runDeliberation } from '../../src/protocol/run.ts';
import { readJson, readText, ADVOCATE_IDS, ADVOCATE_SEATS, JUDGE_IDS, pointIds } from './_fixtures.ts';
import { allKeys, makeClient, makeStore, allStrings, type FakeClient, type FakeStore, type ScriptedResponse } from './_fakes.ts';

const DELIBERATION_ID = 'd-0001';
const chargeSheet = readJson<Record<string, unknown>>('charge-sheets', 'T-001.stored.json');

const stanceText = readText('stances', 'greyworm.emitted.json');
const opinionText = readText('opinions', 'judge-3.emitted.json');
const ok = (text: string): ScriptedResponse => ({ outcome: 'ok', text });
const REFUSAL: ScriptedResponse = { outcome: 'refusal' };
const TRANSPORT: ScriptedResponse = { outcome: 'transport_error' };
const CAP: ScriptedResponse = { outcome: 'cap_exceeded' };

// Every advocate returns the same valid stance text (three points), so the deliberation's
// valid ids are <role>.p1..p3 for each of the four roles, and judge-3's citations all resolve.
const ALL_VALID_IDS = ADVOCATE_IDS.flatMap((r) => pointIds(r, 3));

const happyScript = (): Record<string, ScriptedResponse[]> => ({
  jon: [ok(stanceText)],
  tyrion: [ok(stanceText)],
  daenerys: [ok(stanceText)],
  greyworm: [ok(stanceText)],
  'judge-1': [ok(opinionText)],
  'judge-2': [ok(opinionText)],
  'judge-3': [ok(opinionText)],
});

// The documents say a failed deliberation is recorded on the job row; they do not say whether
// runDeliberation also rejects. Either is tolerated here; the state assertions are what count.
async function run(client: FakeClient, store: FakeStore): Promise<unknown> {
  try {
    return await runDeliberation({
      client,
      store,
      chargeSheet: chargeSheet as never,
      deliberation_id: DELIBERATION_ID,
    });
  } catch (err) {
    return err;
  }
}

const isAdvocate = (r: string) => ADVOCATE_IDS.includes(r);
const isJudge = (r: string) => JUDGE_IDS.includes(r);
const rolesCalled = (client: FakeClient) => client.calls.map((c) => c.role_id);

// A stored output that is a stance or an opinion. A failed role must never be stored as one.
const looksLikeStance = (o: unknown) => !!o && typeof o === 'object' && 'points' in (o as object) && 'position' in (o as object);
const looksLikeOpinion = (o: unknown) => !!o && typeof o === 'object' && 'verdict' in (o as object) && 'reasons' in (o as object);

// The job row is described only by what it records: how far the deliberation got, and whether it failed.
// No document names its fields, so these look at values rather than keys.
const jobMentions = (store: FakeStore, word: RegExp) => allStrings(store.getJob()).some((s) => word.test(s));

test('happy path: seven calls, one per role, no more', async () => {
  const client = makeClient(happyScript());
  const store = makeStore();
  await run(client, store);
  assert.equal(client.calls.length, 7);
  assert.deepEqual([...rolesCalled(client)].sort(), [...ADVOCATE_IDS, ...JUDGE_IDS].sort());
});

test('happy path: two stages, advocates first and judges only after all four advocates resolved', async () => {
  const client = makeClient(happyScript());
  await run(client, makeStore());
  const roles = rolesCalled(client);
  assert.deepEqual(roles.slice(0, 4).sort(), [...ADVOCATE_IDS].sort(), 'first four calls are the advocates');
  assert.deepEqual(roles.slice(4).sort(), [...JUDGE_IDS].sort(), 'last three calls are the judges');
  for (const c of client.calls.filter((c) => isJudge(c.role_id))) {
    assert.deepEqual([...c.completedBefore].sort(), [...ADVOCATE_IDS].sort(), `${c.role_id} was called before every advocate resolved`);
  }
});

test('happy path: the four advocates run concurrently, and so do the three judges', async () => {
  const client = makeClient(happyScript());
  await run(client, makeStore());
  const advocateInFlight = Math.max(...client.calls.filter((c) => isAdvocate(c.role_id)).map((c) => c.inFlightAtStart));
  const judgeInFlight = Math.max(...client.calls.filter((c) => isJudge(c.role_id)).map((c) => c.inFlightAtStart));
  assert.equal(advocateInFlight, 4, 'all four advocate calls must be in flight together');
  assert.equal(judgeInFlight, 3, 'all three judge calls must be in flight together');
});

test('happy path: every output is stored, stances as ingested and opinions as stored', async () => {
  const client = makeClient(happyScript());
  const store = makeStore();
  await run(client, store);
  assert.deepEqual([...store.outputs.keys()].sort(), [...ADVOCATE_IDS, ...JUDGE_IDS].sort());

  // greyworm's stored stance is the document's own stored instance.
  assert.deepEqual(store.getOutput('greyworm'), readJson('stances', 'greyworm.stored.json'));
  for (const [role_id, seat] of ADVOCATE_SEATS) {
    const s = store.getOutput(role_id) as { role_id: string; seat: string; deliberation_id: string; points: Array<{ id: string }> };
    assert.equal(s.role_id, role_id);
    assert.equal(s.seat, seat);
    assert.equal(s.deliberation_id, DELIBERATION_ID);
    assert.deepEqual(s.points.map((p) => p.id), pointIds(role_id, 3));
  }

  // judge-3's stored opinion is the document's own stored instance.
  assert.deepEqual(store.getOutput('judge-3'), readJson('opinions', 'judge-3.stored.json'));
  const labels = new Set<string>();
  for (const role_id of JUDGE_IDS) {
    const o = store.getOutput(role_id) as { role_id: string; label: string; deliberation_id: string };
    assert.equal(o.role_id, role_id);
    assert.equal(o.deliberation_id, DELIBERATION_ID);
    assert.equal(typeof o.label, 'string');
    assert.ok(o.label.length > 0);
    labels.add(o.label);
    assert.deepEqual(Object.keys(o).sort(), ['against', 'deliberation_id', 'label', 'reasons', 'role_id', 'verdict']);
  }
  assert.equal(labels.size, 3, 'each judge carries its own profile label');
});

test('happy path: the job is not marked failed', async () => {
  const client = makeClient(happyScript());
  const store = makeStore();
  await run(client, store);
  assert.ok(store.getJob() !== undefined, 'the job row is written');
  assert.equal(jobMentions(store, /fail/i), false, JSON.stringify(store.getJob()));
});

test('prompt assembly: every prompt begins with the same charge sheet block, byte for byte', async () => {
  const client = makeClient(happyScript());
  await run(client, makeStore());
  const first = client.calls[0]!.prompt;
  const header = `CASE T-001\nAccused: Jon Snow\nDeceased: Daenerys Targaryen\nAct alleged: ${chargeSheet.act_alleged}\n`;
  assert.ok(first.startsWith(header), `prompt does not start with the charge sheet block layout:\n${first.slice(0, 200)}`);
  // The block ends with the verdict values and the scope note; everything before them is shared.
  const blockEnd = first.indexOf(String(chargeSheet.scope_note)) + String(chargeSheet.scope_note).length;
  assert.ok(blockEnd > 0, 'scope note not found in prompt');
  const block = first.slice(0, blockEnd);
  for (const c of client.calls) {
    assert.ok(c.prompt.startsWith(block), `${c.role_id} prompt does not start with the shared charge sheet block`);
  }
  assert.ok(block.includes('Verdict values: justified, not_justified'));
  assert.ok(block.includes(`1. ${(chargeSheet.agreed_record as string[])[0]}`));
  assert.ok(block.includes(`5. ${(chargeSheet.agreed_record as string[])[4]}`));
});

test('prompt assembly: judges see the four stances with their point ids; advocates see no stance', async () => {
  const client = makeClient(happyScript());
  await run(client, makeStore());
  for (const c of client.calls) {
    for (const id of ALL_VALID_IDS) {
      assert.equal(c.prompt.includes(id), isJudge(c.role_id), `${c.role_id} prompt ${isJudge(c.role_id) ? 'lacks' : 'contains'} ${id}`);
    }
  }
  // Seat order in the stances block: defense, defense, prosecution, prosecution.
  for (const c of client.calls.filter((x) => isJudge(x.role_id))) {
    const positions = ['jon.p1', 'tyrion.p1', 'daenerys.p1', 'greyworm.p1'].map((id) => c.prompt.indexOf(id));
    const defenseLast = Math.max(positions[0]!, positions[1]!);
    const prosecutionFirst = Math.min(positions[2]!, positions[3]!);
    assert.ok(defenseLast < prosecutionFirst, `${c.role_id}: defense stances must precede prosecution stances`);
  }
});

test('prompt assembly: a hash is sent with every call, and equal prompts hash equal', async () => {
  const client = makeClient(happyScript());
  await run(client, makeStore());
  for (const c of client.calls) {
    assert.equal(typeof c.hash, 'string');
    assert.ok(c.hash.length > 0, `${c.role_id} has an empty hash`);
  }
  const byPrompt = new Map<string, string>();
  for (const c of client.calls) {
    const seen = byPrompt.get(c.prompt);
    if (seen !== undefined) assert.equal(c.hash, seen, 'same prompt text, different hash');
    byPrompt.set(c.prompt, c.hash);
  }
  const distinctPrompts = new Set(client.calls.map((c) => c.prompt)).size;
  const distinctHashes = new Set(client.calls.map((c) => c.hash)).size;
  assert.equal(distinctHashes, distinctPrompts, 'different prompt text must give different hashes');
});

test('malformed stance: one corrective retry with a different prompt, then success', async () => {
  const script = happyScript();
  script.jon = [ok(readText('stances', 'invalid', 'not-json.txt')), ok(stanceText)];
  const client = makeClient(script);
  const store = makeStore();
  await run(client, store);
  assert.equal(client.calls.length, 8);
  const prompts = client.promptsFor('jon');
  assert.equal(prompts.length, 2);
  assert.notEqual(prompts[1], prompts[0], 'an identical resend at temperature 0 is wasted');
  assert.ok(prompts[1]!.startsWith(prompts[0]!), 'blocks 1 to 5 are unchanged on retry; the corrective block is appended');
  const corrective = prompts[1]!.slice(prompts[0]!.length);
  assert.ok(corrective.trim().length > 0, 'corrective block is empty');
  assert.match(corrective, /JSON/, 'the corrective block names what failed: the response was not a JSON object');
  const [first, second] = client.callsFor('jon');
  assert.notEqual(first!.hash, second!.hash);
  assert.ok(looksLikeStance(store.getOutput('jon')));
  assert.equal(store.outputs.size, 7);
});

test('malformed stance twice: the role fails after its one retry, no third attempt, no judge call', async () => {
  const script = happyScript();
  const bad = ok(readText('stances', 'invalid', 'position-outside-set.json'));
  script.jon = [bad, bad, ok(stanceText)];
  const client = makeClient(script);
  const store = makeStore();
  await run(client, store);
  assert.equal(client.callsFor('jon').length, 2, 'one corrective retry, then a visible failure');
  assert.equal(client.calls.filter((c) => isJudge(c.role_id)).length, 0, 'no judge is called on fewer than four stances');
  assert.equal(client.calls.length, 5);
  assert.ok(!looksLikeStance(store.getOutput('jon')), 'a failed stance must not be stored as a stance');
  for (const r of ['tyrion', 'daenerys', 'greyworm']) assert.ok(looksLikeStance(store.getOutput(r)), `${r} stance stands`);
  const corrective = client.promptsFor('jon')[1]!.slice(client.promptsFor('jon')[0]!.length);
  assert.match(corrective, /position/, 'the corrective block names the field that failed');
});

test('malformed opinion: one corrective retry naming what failed, then success', async () => {
  const script = happyScript();
  script['judge-2'] = [ok(readText('opinions', 'invalid', 'verdict-with-space.json')), ok(opinionText)];
  const client = makeClient(script);
  const store = makeStore();
  await run(client, store);
  assert.equal(client.calls.length, 8);
  const prompts = client.promptsFor('judge-2');
  assert.equal(prompts.length, 2);
  assert.ok(prompts[1]!.startsWith(prompts[0]!));
  const corrective = prompts[1]!.slice(prompts[0]!.length);
  assert.match(corrective, /verdict/, 'names the failed field');
  assert.ok(looksLikeOpinion(store.getOutput('judge-2')));
});

test('prose opinion: the corrective retry quotes the required form', async () => {
  const script = happyScript();
  script['judge-1'] = [ok(readText('opinions', 'invalid', 'not-json.txt')), ok(opinionText)];
  const client = makeClient(script);
  await run(client, makeStore());
  const prompts = client.promptsFor('judge-1');
  assert.equal(prompts.length, 2);
  const corrective = prompts[1]!.slice(prompts[0]!.length);
  for (const field of ['"verdict"', '"reasons"', '"relies_on"', '"against"']) {
    assert.ok(corrective.includes(field), `corrective block does not quote the required form (${field})`);
  }
});

test('prose opinion twice: the column fails, the other two opinions stand', async () => {
  const script = happyScript();
  const prose = ok(readText('opinions', 'invalid', 'not-json.txt'));
  script['judge-1'] = [prose, prose, ok(opinionText)];
  const client = makeClient(script);
  const store = makeStore();
  await run(client, store);
  assert.equal(client.callsFor('judge-1').length, 2);
  assert.equal(client.calls.length, 8);
  assert.ok(!looksLikeOpinion(store.getOutput('judge-1')), 'prose must not be stored as an opinion');
  assert.ok(looksLikeOpinion(store.getOutput('judge-2')));
  assert.ok(looksLikeOpinion(store.getOutput('judge-3')));
});

test('unresolvable id: one corrective retry whose prompt contains the list of valid ids', async () => {
  const script = happyScript();
  script['judge-3'] = [ok(readText('opinions', 'invalid', 'unresolvable-id.json')), ok(opinionText)];
  const client = makeClient(script);
  const store = makeStore();
  await run(client, store);
  assert.equal(client.calls.length, 8);
  const prompts = client.promptsFor('judge-3');
  assert.equal(prompts.length, 2);
  assert.notEqual(prompts[1], prompts[0]);
  assert.ok(prompts[1]!.startsWith(prompts[0]!));
  const corrective = prompts[1]!.slice(prompts[0]!.length);
  for (const id of ALL_VALID_IDS) assert.ok(corrective.includes(id), `corrective block lacks valid id ${id}`);
  assert.match(corrective, /tyrion\.p6/, 'names the id that did not resolve');
  assert.deepEqual(store.getOutput('judge-3'), readJson('opinions', 'judge-3.stored.json'));
});

test('unresolvable id twice: the judge fails after one retry', async () => {
  const script = happyScript();
  const bad = ok(readText('opinions', 'invalid', 'unresolvable-id-case.json'));
  script['judge-3'] = [bad, bad, ok(opinionText)];
  const client = makeClient(script);
  const store = makeStore();
  await run(client, store);
  assert.equal(client.callsFor('judge-3').length, 2);
  assert.ok(!looksLikeOpinion(store.getOutput('judge-3')));
  assert.ok(looksLikeOpinion(store.getOutput('judge-1')));
  assert.ok(looksLikeOpinion(store.getOutput('judge-2')));
});

test('malformed and unresolvable together: one retry, and its corrective block names both', async () => {
  const script = happyScript();
  const both = readJson<{ reasons: Array<{ relies_on: string[] }> }>('opinions', 'invalid', 'verdict-with-space.json');
  both.reasons[0]!.relies_on = ['tyrion.p6'];
  script['judge-1'] = [ok(JSON.stringify(both)), ok(opinionText)];
  const client = makeClient(script);
  await run(client, makeStore());
  const prompts = client.promptsFor('judge-1');
  assert.equal(prompts.length, 2);
  const corrective = prompts[1]!.slice(prompts[0]!.length);
  assert.match(corrective, /verdict/);
  assert.match(corrective, /tyrion\.p6/);
});

test('refusal outcome from the client: zero retries, deliberation stops before the judge stage', async () => {
  const script = happyScript();
  script.daenerys = [REFUSAL, ok(stanceText)];
  const client = makeClient(script);
  const store = makeStore();
  await run(client, store);
  assert.equal(client.callsFor('daenerys').length, 1, 'a refusal gets zero retries');
  assert.equal(client.calls.filter((c) => isJudge(c.role_id)).length, 0);
  assert.equal(client.calls.length, 4);
  assert.ok(!looksLikeStance(store.getOutput('daenerys')));
  assert.equal(store.outputs.has('judge-1') || store.outputs.has('judge-2') || store.outputs.has('judge-3'), false);
});

test('refusal in prose (ok outcome, refusal text) is a non-object: one corrective retry, then the role fails with both texts stored', async () => {
  const script = happyScript();
  const prose = readText('stances', 'invalid', 'refusal.txt');
  script.greyworm = [ok(prose), ok(prose)];
  const client = makeClient(script);
  const store = makeStore();
  await run(client, store);
  assert.equal(client.callsFor('greyworm').length, 2, 'prose gets exactly one corrective retry');
  assert.equal(client.calls.filter((c) => isJudge(c.role_id)).length, 0);
  const rec = store.getOutput('greyworm') as { failed: boolean; attempts: { text: string; hash: string }[] };
  assert.ok(!looksLikeStance(rec));
  assert.equal(rec.failed, true);
  assert.equal(rec.attempts.length, 2);
  assert.ok(rec.attempts.every((a) => a.text === prose), 'raw text of every attempt is stored');
  assert.deepEqual(rec.attempts.map((a) => a.hash), client.callsFor('greyworm').map((c) => c.hash), 'attempt hashes tie the record to its log rows');
});

test('refusal in prose recovered by the corrective retry: the role succeeds', async () => {
  const script = happyScript();
  script.greyworm = [ok(readText('stances', 'invalid', 'refusal.txt')), ok(stanceText)];
  const client = makeClient(script);
  const store = makeStore();
  await run(client, store);
  assert.equal(client.callsFor('greyworm').length, 2);
  assert.ok(looksLikeStance(store.getOutput('greyworm')));
  assert.equal(client.calls.length, 8);
});

test('judge refusal in prose: one corrective retry, then the column fails and the other two opinions stand', async () => {
  const script = happyScript();
  const prose = readText('opinions', 'invalid', 'refusal.txt');
  script['judge-2'] = [ok(prose), ok(prose)];
  const client = makeClient(script);
  const store = makeStore();
  await run(client, store);
  assert.equal(client.callsFor('judge-2').length, 2);
  assert.equal(client.calls.length, 8);
  assert.ok(!looksLikeOpinion(store.getOutput('judge-2')));
  assert.ok(looksLikeOpinion(store.getOutput('judge-1')));
  assert.ok(looksLikeOpinion(store.getOutput('judge-3')));
  const job = store.getJob() as { status: string };
  assert.equal(job.status, 'incomplete');
});

test('a failure record carries no key that appears in a stance or an opinion, at any depth', async () => {
  const script = happyScript();
  script.tyrion = [REFUSAL];
  const client = makeClient(script);
  const store = makeStore();
  await run(client, store);
  const rec = store.getOutput('tyrion');
  const keys = new Set(allKeys(rec));
  for (const k of ['verdict', 'position', 'points', 'reasons', 'against', 'claim', 'support', 'relies_on']) {
    assert.ok(!keys.has(k), `failure record contains output key "${k}"`);
  }
  assert.equal((rec as { failed: boolean }).failed, true);
});

test('judge refusal outcome: the failed judge leaves the other two opinions stored', async () => {
  const script = happyScript();
  script['judge-1'] = [REFUSAL, ok(opinionText)];
  const client = makeClient(script);
  const store = makeStore();
  await run(client, store);
  assert.equal(client.callsFor('judge-1').length, 1);
  assert.equal(client.calls.length, 7);
  assert.ok(!looksLikeOpinion(store.getOutput('judge-1')));
  assert.deepEqual(store.getOutput('judge-3'), readJson('opinions', 'judge-3.stored.json'));
  assert.ok(looksLikeOpinion(store.getOutput('judge-2')));
  // Every stance still stands.
  for (const r of ADVOCATE_IDS) assert.ok(looksLikeStance(store.getOutput(r)));
});

test('fewer than four stances: the job records how far it got and is not presented as complete', async () => {
  const script = happyScript();
  script.tyrion = [REFUSAL];
  const client = makeClient(script);
  const store = makeStore();
  await run(client, store);
  const job = store.getJob();
  assert.ok(job !== undefined, 'the job row records how far the deliberation got');
  // No string value on the job row reads as a completed deliberation.
  for (const s of allStrings(job)) {
    assert.ok(!['complete', 'completed', 'done', 'success', 'succeeded'].includes(s.toLowerCase()), `job reads as complete: ${JSON.stringify(job)}`);
  }
  // The stage reached is recorded: the deliberation stopped in the advocate stage.
  assert.ok(jobMentions(store, /advocate/i), `job does not record the stage reached: ${JSON.stringify(job)}`);
});

test('transport failure that persists through the client budget: the role fails, no protocol retry', async () => {
  // Transport retries belong to the client module; from the protocol's side a transport_error is a failed role.
  const script = happyScript();
  script.jon = [TRANSPORT, ok(stanceText)];
  const client = makeClient(script);
  const store = makeStore();
  await run(client, store);
  assert.equal(client.callsFor('jon').length, 1);
  assert.equal(client.calls.filter((c) => isJudge(c.role_id)).length, 0);
  assert.ok(!looksLikeStance(store.getOutput('jon')));
});

test('every attempt produces a log row carrying the role and the prompt hash', async () => {
  const script = happyScript();
  script.jon = [ok(readText('stances', 'invalid', 'too-few-points.json')), ok(stanceText)];
  script['judge-2'] = [ok(readText('opinions', 'invalid', 'unresolvable-id.json')), ok(opinionText)];
  const client = makeClient(script);
  await run(client, makeStore());
  assert.equal(client.calls.length, 9);
  assert.equal(client.log.length, 9, 'one log row per attempt, retries included');
  client.log.forEach((row, i) => {
    assert.equal(row.role_id, client.calls[i]!.role_id);
    assert.equal(row.hash, client.calls[i]!.hash);
  });
  assert.equal(client.log.filter((r) => r.role_id === 'jon').length, 2);
  assert.equal(client.log.filter((r) => r.role_id === 'judge-2').length, 2);
});

test('failed attempts produce log rows too', async () => {
  const script = happyScript();
  script.greyworm = [REFUSAL];
  const client = makeClient(script);
  await run(client, makeStore());
  assert.equal(client.log.length, 4);
  assert.deepEqual(client.log.filter((r) => r.outcome === 'refusal').map((r) => r.role_id), ['greyworm']);
});

test('re-entry: a role with a stored output is not called again', async () => {
  // First invocation stores everything.
  const first = makeClient(happyScript());
  const store = makeStore();
  await run(first, store);
  assert.equal(store.outputs.size, 7);

  // Second invocation on the same store: a fresh client is given nothing to answer with.
  const second = makeClient({});
  const again = makeStore({ outputs: Object.fromEntries(store.outputs), job: store.getJob() });
  await run(second, again);
  assert.equal(second.calls.length, 0, 'no model call for any role whose output is stored');
  assert.deepEqual(Object.fromEntries(again.outputs), Object.fromEntries(store.outputs), 'stored outputs are unchanged');
});

test('re-entry: with the four stances stored, only the judges are called', async () => {
  const stanceRun = makeClient(happyScript());
  const source = makeStore();
  await run(stanceRun, source);
  const stances = Object.fromEntries(ADVOCATE_IDS.map((r) => [r, source.getOutput(r)]));

  const script = happyScript();
  const client = makeClient(script);
  const store = makeStore({ outputs: stances });
  await run(client, store);
  assert.deepEqual([...rolesCalled(client)].sort(), [...JUDGE_IDS].sort());
  assert.equal(client.calls.length, 3);
  for (const c of client.calls) for (const id of ALL_VALID_IDS) assert.ok(c.prompt.includes(id), `${c.role_id} lacks stored id ${id}`);
  assert.equal(store.outputs.size, 7);
});

test('re-entry: with stances and one opinion stored, only the two missing judges are called', async () => {
  const full = makeClient(happyScript());
  const source = makeStore();
  await run(full, source);
  const partial = Object.fromEntries([...ADVOCATE_IDS, 'judge-1'].map((r) => [r, source.getOutput(r)]));

  const client = makeClient(happyScript());
  const store = makeStore({ outputs: partial });
  await run(client, store);
  assert.deepEqual([...rolesCalled(client)].sort(), ['judge-2', 'judge-3']);
  assert.deepEqual(store.getOutput('judge-1'), source.getOutput('judge-1'));
  assert.equal(store.outputs.size, 7);
});

test('re-entry: with three stances stored, only the missing advocate is called, then the judges', async () => {
  const full = makeClient(happyScript());
  const source = makeStore();
  await run(full, source);
  const three = Object.fromEntries(['jon', 'tyrion', 'daenerys'].map((r) => [r, source.getOutput(r)]));

  const client = makeClient(happyScript());
  const store = makeStore({ outputs: three });
  await run(client, store);
  assert.deepEqual(rolesCalled(client).slice(0, 1), ['greyworm']);
  assert.deepEqual(rolesCalled(client).slice(1).sort(), [...JUDGE_IDS].sort());
  assert.equal(store.outputs.size, 7);
});

test('a job that is claimed and not stale: claim() false means zero calls and no writes', async () => {
  const client = makeClient(happyScript());
  const store = makeStore({ claim: false });
  await run(client, store);
  assert.ok(store.claimCalls >= 1, 'the function claims the job before doing any work');
  assert.equal(client.calls.length, 0);
  assert.equal(client.log.length, 0);
  assert.equal(store.outputs.size, 0);
});

test('the job is claimed before the first call', async () => {
  const client = makeClient(happyScript());
  const store = makeStore();
  let claimedBeforeCall = false;
  const originalCall = client.call.bind(client);
  client.call = async (req) => {
    if (store.claimCalls >= 1) claimedBeforeCall = true;
    return originalCall(req);
  };
  await run(client, store);
  assert.ok(claimedBeforeCall);
});

test('cap_exceeded on a judge: the deliberation is marked failed', async () => {
  const script = happyScript();
  script['judge-2'] = [CAP, ok(opinionText)];
  const client = makeClient(script);
  const store = makeStore();
  await run(client, store);
  assert.equal(client.callsFor('judge-2').length, 1, 'a refused call is not retried by the protocol');
  assert.ok(!looksLikeOpinion(store.getOutput('judge-2')));
  assert.ok(jobMentions(store, /fail/i), `job not marked failed: ${JSON.stringify(store.getJob())}`);
});

test('cap_exceeded on an advocate: marked failed, no judge is called', async () => {
  const script = happyScript();
  script.greyworm = [CAP, ok(stanceText)];
  const client = makeClient(script);
  const store = makeStore();
  await run(client, store);
  assert.equal(client.callsFor('greyworm').length, 1);
  assert.equal(client.calls.filter((c) => isJudge(c.role_id)).length, 0);
  assert.ok(jobMentions(store, /fail/i), `job not marked failed: ${JSON.stringify(store.getJob())}`);
});

test('a failed role is never stored as a result: no fallback text, default verdict, or substitution', async () => {
  const script = happyScript();
  script.jon = [ok(readText('stances', 'invalid', 'extra-field.json')), ok(readText('stances', 'invalid', 'claim-over-bound.json'))];
  const client = makeClient(script);
  const store = makeStore();
  await run(client, store);
  const out = store.getOutput('jon');
  assert.ok(!looksLikeStance(out), 'invalid stance text must not be stored as a stance');
  if (out && typeof out === 'object') {
    assert.ok(!('position' in out), 'no default position for a failed role');
  }
  for (const r of JUDGE_IDS) {
    const o = store.getOutput(r);
    assert.ok(!looksLikeOpinion(o), `${r} must have no opinion when the judge stage did not run`);
  }
});

test('the deliberation_id given is the one written into every stored output', async () => {
  const client = makeClient(happyScript());
  const store = makeStore();
  await run(client, store);
  for (const [, o] of store.outputs) {
    assert.equal((o as { deliberation_id: string }).deliberation_id, DELIBERATION_ID);
  }
});
