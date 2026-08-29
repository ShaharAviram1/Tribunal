// Judicial opinion validation, derived from docs/judicial-opinion.schema.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateOpinion } from '../../src/protocol/validate-opinion.ts';
import { readJson, readText, listDir, clone, pointIds } from './_fixtures.ts';

type Reason = { text: string; relies_on: string[] };
type Emitted = { verdict: string; reasons: Reason[]; against: { text: string; relies_on: string[] } };

// The deliberation the fixtures refer to: four stances, Tyrion's with five points so that
// `tyrion.p6` is the document's unresolvable instance ("if Tyrion's stance has five points or fewer").
const VALID_IDS: string[] = [
  ...pointIds('jon', 3),
  ...pointIds('tyrion', 5),
  ...pointIds('daenerys', 3),
  ...pointIds('greyworm', 3),
];

const emitted = () => readJson<Emitted>('opinions', 'judge-3.emitted.json');
const emittedText = () => readText('opinions', 'judge-3.emitted.json');

const reject = (raw: string, ids: string[] = VALID_IDS) => {
  const result = validateOpinion(raw, ids);
  assert.equal(result.ok, false, `expected rejection, got ${JSON.stringify(result)}`);
  if (result.ok) throw new Error('unreachable');
  return result;
};

// Section 4 and section 6: the kind each invalid fixture maps to.
const expected: Record<string, 'malformed' | 'unresolvable_id' | 'refusal'> = {
  'not-json.txt': 'malformed',
  'extra-field.json': 'malformed',
  'verdict-with-space.json': 'malformed',
  'too-few-reasons.json': 'malformed',
  'reason-empty-relies-on.json': 'malformed',
  'empty-text.json': 'malformed',
  'unresolvable-id.json': 'unresolvable_id',
  'unresolvable-id-case.json': 'unresolvable_id',
  'refusal.txt': 'malformed', // prose is never classified as a refusal
};

test('every invalid opinion fixture has an expectation', () => {
  for (const name of listDir('opinions', 'invalid')) {
    assert.ok(name in expected, `no expectation written for fixture ${name}`);
  }
});

for (const [name, kind] of Object.entries(expected)) {
  test(`invalid/${name} is rejected as ${kind}`, () => {
    const result = reject(readText('opinions', 'invalid', name));
    assert.equal(result.kind, kind);
    assert.equal(typeof result.detail, 'string');
    assert.ok(result.detail.length > 0, 'detail must name what failed');
  });
}

test('unresolvable fixtures list the ids that did not resolve', () => {
  const a = reject(readText('opinions', 'invalid', 'unresolvable-id.json'));
  assert.deepEqual(a.unresolved, ['tyrion.p6']);
  assert.match(a.detail, /tyrion\.p6/);
  const b = reject(readText('opinions', 'invalid', 'unresolvable-id-case.json'));
  assert.deepEqual(b.unresolved, ['Tyrion.p2']);
  assert.match(b.detail, /Tyrion\.p2/);
});

test('a malformed detail names the failing field', () => {
  assert.match(reject(readText('opinions', 'invalid', 'extra-field.json')).detail, /concurs_with/);
  assert.match(reject(readText('opinions', 'invalid', 'verdict-with-space.json')).detail, /verdict/);
  assert.match(reject(readText('opinions', 'invalid', 'too-few-reasons.json')).detail, /reasons/);
  assert.match(reject(readText('opinions', 'invalid', 'reason-empty-relies-on.json')).detail, /relies_on/);
  assert.match(reject(readText('opinions', 'invalid', 'empty-text.json')).detail, /text/);
});

test('the valid emitted fixture passes against the deliberation ids and is returned unchanged', () => {
  const result = validateOpinion(emittedText(), VALID_IDS);
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) throw new Error('unreachable');
  assert.deepEqual(result.opinion, emitted());
});

test('the valid fixture becomes unresolvable when the deliberation lacks a cited stance', () => {
  // judge-3 cites greyworm.p2, daenerys.p1, greyworm.p3 and jon.p1; drop daenerys.
  const ids = VALID_IDS.filter((id) => !id.startsWith('daenerys.'));
  const result = reject(emittedText(), ids);
  assert.equal(result.kind, 'unresolvable_id');
  assert.deepEqual(result.unresolved, ['daenerys.p1']);
});

test('id resolution is exact: case and whitespace variants do not resolve', () => {
  for (const bad of ['Tyrion.p2', 'tyrion.P2', ' tyrion.p2', 'tyrion.p2 ', 'tyrion.p2\n', 'TYRION.P2', 'tyrion .p2']) {
    const o = clone(emitted());
    o.reasons[0]!.relies_on = [bad];
    const result = reject(JSON.stringify(o));
    assert.equal(result.kind, 'unresolvable_id', `expected ${JSON.stringify(bad)} to be unresolvable`);
    assert.deepEqual(result.unresolved, [bad]);
  }
});

test('id resolution: n must be within the stance point count, and the role must exist', () => {
  for (const bad of ['tyrion.p6', 'jon.p4', 'jon.p0', 'judge-1.p1', 'cersei.p1', 'jon.1', 'jon-p1', 'p1']) {
    const o = clone(emitted());
    o.against.relies_on = [bad];
    const result = reject(JSON.stringify(o));
    assert.equal(result.kind, 'unresolvable_id', `expected ${JSON.stringify(bad)} to be unresolvable`);
    assert.deepEqual(result.unresolved, [bad]);
  }
});

test('every unresolvable id is reported, across reasons and against', () => {
  const o = clone(emitted());
  o.reasons[0]!.relies_on = ['greyworm.p2', 'tyrion.p6'];
  o.reasons[1]!.relies_on = ['Tyrion.p2'];
  o.against.relies_on = ['jon.p9'];
  const result = reject(JSON.stringify(o));
  assert.equal(result.kind, 'unresolvable_id');
  assert.deepEqual([...(result.unresolved ?? [])].sort(), ['Tyrion.p2', 'jon.p9', 'tyrion.p6']);
  for (const id of ['tyrion.p6', 'Tyrion.p2', 'jon.p9']) assert.ok(result.detail.includes(id), `detail lacks ${id}`);
});

test('an empty against.relies_on is valid', () => {
  const o = clone(emitted());
  o.against.relies_on = [];
  const result = validateOpinion(JSON.stringify(o), VALID_IDS);
  assert.equal(result.ok, true, JSON.stringify(result));
});

test('malformed wins where both apply, and the detail names both', () => {
  // Verdict with a space (section 6, malformed) plus tyrion.p6 (section 6, unresolvable).
  const o = readJson<Emitted>('opinions', 'invalid', 'verdict-with-space.json');
  o.reasons[0]!.relies_on = ['tyrion.p6'];
  const result = reject(JSON.stringify(o));
  assert.equal(result.kind, 'malformed');
  assert.match(result.detail, /verdict/);
  assert.match(result.detail, /tyrion\.p6/);
});

test('malformed wins: an extra field together with an unresolvable id', () => {
  const o = readJson<Emitted>('opinions', 'invalid', 'extra-field.json');
  o.against.relies_on = ['Tyrion.p2'];
  const result = reject(JSON.stringify(o));
  assert.equal(result.kind, 'malformed');
  assert.match(result.detail, /concurs_with/);
  assert.match(result.detail, /Tyrion\.p2/);
});

// Constructed instances for the rejection conditions of section 1 and 4 not covered by a fixture file.
const malformedVariants: Array<{ name: string; change: (o: Emitted) => unknown }> = [
  { name: 'against missing', change: (o) => { delete (o as Partial<Emitted>).against; return o; } },
  { name: 'reasons missing', change: (o) => { delete (o as Partial<Emitted>).reasons; return o; } },
  { name: 'verdict missing', change: (o) => { delete (o as Partial<Emitted>).verdict; return o; } },
  { name: 'verdict capitalised', change: (o) => { o.verdict = 'Justified'; return o; } },
  { name: 'verdict with trailing whitespace', change: (o) => { o.verdict = 'justified '; return o; } },
  { name: 'verdict outside the set', change: (o) => { o.verdict = 'guilty'; return o; } },
  { name: 'against.text empty after trimming', change: (o) => { o.against.text = ' \n '; return o; } },
  { name: 'against with an extra field', change: (o) => { (o.against as Record<string, unknown>).weight = 1; return o; } },
  { name: 'against.relies_on missing', change: (o) => { delete (o.against as Partial<Emitted['against']>).relies_on; return o; } },
  { name: 'reason with an extra field', change: (o) => { (o.reasons[0] as Record<string, unknown>).rank = 1; return o; } },
  { name: 'reason missing relies_on', change: (o) => { delete (o.reasons[0] as Partial<Reason>).relies_on; return o; } },
  { name: 'reasons empty', change: (o) => { o.reasons = []; return o; } },
  { name: 'label supplied by the model', change: (o) => { (o as Record<string, unknown>).label = 'Shamgar model'; return o; } },
  { name: 'role_id supplied by the model', change: (o) => { (o as Record<string, unknown>).role_id = 'judge-3'; return o; } },
  { name: 'JSON array rather than object', change: (o) => [o] },
];

for (const v of malformedVariants) {
  test(`constructed malformed: ${v.name}`, () => {
    const result = reject(JSON.stringify(v.change(clone(emitted()))));
    assert.equal(result.kind, 'malformed');
  });
}

test('constructed malformed: empty response and code-fenced JSON', () => {
  assert.equal(reject('').kind, 'malformed');
  assert.equal(reject('```json\n' + emittedText() + '\n```').kind, 'malformed');
});

test('constructed valid: verdict justified, exactly two reasons each citing one id', () => {
  const o = clone(emitted());
  o.verdict = 'justified';
  o.reasons = [
    { text: 'First.', relies_on: ['jon.p1'] },
    { text: 'Second.', relies_on: ['tyrion.p5'] },
  ];
  const result = validateOpinion(JSON.stringify(o), VALID_IDS);
  assert.equal(result.ok, true, JSON.stringify(result));
});

test('the stored fixture carries the three system fields and no other additions', () => {
  const stored = readJson<Record<string, unknown>>('opinions', 'judge-3.stored.json');
  const { role_id, label, deliberation_id, ...rest } = stored;
  assert.equal(role_id, 'judge-3');
  assert.equal(label, 'Shamgar model');
  assert.equal(deliberation_id, 'd-0001');
  assert.deepEqual(rest, emitted());
});
