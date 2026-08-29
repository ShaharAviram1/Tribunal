// Charge sheet validation and stamping, derived from docs/charge-sheet.spec.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateChargeSheet } from '../../src/protocol/validate-charge-sheet.ts';
import { stampChargeSheet } from '../../src/protocol/stamp.ts';
import { readJson, listDir, clone, words } from './_fixtures.ts';

type Failure = { code: string; field: string };

const filed = () => readJson<Record<string, unknown>>('charge-sheets', 'T-001.filed.json');

const failuresOf = (input: unknown): Failure[] => {
  const result = validateChargeSheet(input);
  assert.equal(result.ok, false, 'expected rejection');
  if (result.ok) throw new Error('unreachable');
  return result.failures;
};

const pairs = (failures: Failure[]) => failures.map((f) => `${f.code} ${f.field}`).sort();

// Section 6: the expected failure set of each invalid fixture, code plus the field concerned.
// The filename names the primary code; the document names the companion failures.
const expected: Record<string, string[]> = {
  'CS-01.empty-record.json': ['CS-01 agreed_record', 'CS-03 agreed_record'],
  'CS-02.act-over-bound.json': ['CS-02 act_alleged'],
  'CS-03.single-item-record.json': ['CS-03 agreed_record'],
  'CS-04.two-questions.json': ['CS-04 question'],
  'CS-05.extra-field.json': ['CS-05 note_to_judges'],
  'CS-05.stamped-field-sent.json': ['CS-05 verdict_values'],
  'CS-06.record-not-array.json': ['CS-06 agreed_record'],
  'CS-multi.empty-record-and-case-id.json': ['CS-01 agreed_record', 'CS-03 agreed_record', 'CS-05 case_id'],
};

test('every invalid fixture is covered by an expectation, and passes.* is the only exception', () => {
  const names = listDir('charge-sheets', 'invalid');
  for (const name of names) {
    if (name.startsWith('passes.')) continue;
    assert.ok(name in expected, `no expectation written for fixture ${name}`);
  }
});

for (const [name, want] of Object.entries(expected)) {
  test(`invalid/${name} fails with exactly ${want.join(', ')}`, () => {
    const failures = failuresOf(readJson('charge-sheets', 'invalid', name));
    assert.deepEqual(pairs(failures), want);
  });
}

test('the filename code of each invalid fixture appears in its result', () => {
  for (const name of listDir('charge-sheets', 'invalid')) {
    if (name.startsWith('passes.')) continue;
    const code = name.split('.')[0]!;
    const codes = failuresOf(readJson('charge-sheets', 'invalid', name)).map((f) => f.code);
    if (code === 'CS-multi') {
      assert.ok(codes.length > 1, `${name}: expected more than one failure`);
    } else {
      assert.ok(codes.includes(code), `${name}: expected ${code} in ${codes.join(', ')}`);
    }
  }
});

test('the multi-failure fixture reports all three rules in one result', () => {
  const failures = failuresOf(readJson('charge-sheets', 'invalid', 'CS-multi.empty-record-and-case-id.json'));
  assert.equal(failures.length, 3);
  assert.deepEqual(new Set(failures.map((f) => f.code)), new Set(['CS-01', 'CS-03', 'CS-05']));
});

test('every failure carries a code of the form CS-0n and a field name', () => {
  for (const name of Object.keys(expected)) {
    for (const f of failuresOf(readJson('charge-sheets', 'invalid', name))) {
      assert.match(f.code, /^CS-0[1-6]$/, `${name}: code ${f.code}`);
      assert.equal(typeof f.field, 'string');
      assert.ok(f.field.length > 0, `${name}: empty field on ${f.code}`);
    }
  }
});

test('T-001 as filed passes, and is returned as filed', () => {
  const input = filed();
  const result = validateChargeSheet(input);
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) throw new Error('unreachable');
  assert.deepEqual(result.sheet, input);
  assert.deepEqual(
    Object.keys(result.sheet).sort(),
    ['accused', 'act_alleged', 'agreed_record', 'base_premises', 'deceased', 'question'],
  );
});

test('a slanted act_alleged within bounds passes: slant is not enforceable by rule (CS-02)', () => {
  const result = validateChargeSheet(readJson('charge-sheets', 'invalid', 'passes.slanted-act.json'));
  assert.equal(result.ok, true, JSON.stringify(result));
});

test('validation never repairs: the accepted sheet is identical to the input, byte for byte', () => {
  const input = filed();
  const before = JSON.stringify(input);
  const result = validateChargeSheet(input);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('unreachable');
  assert.equal(JSON.stringify(result.sheet), before);
  assert.equal(JSON.stringify(input), before, 'input was mutated');
});

// Section 3, constructed boundary instances, one change each to T-001 as filed.
const variants: Array<{ name: string; change: (s: Record<string, unknown>) => void; want: string[] }> = [
  { name: 'CS-01 accused missing', change: (s) => { delete s.accused; }, want: ['CS-01 accused'] },
  { name: 'CS-01 deceased whitespace only', change: (s) => { s.deceased = '   '; }, want: ['CS-01 deceased'] },
  { name: 'CS-01 question missing', change: (s) => { delete s.question; }, want: ['CS-01 question'] },
  { name: 'CS-02 accused 81 characters', change: (s) => { s.accused = 'a'.repeat(81); }, want: ['CS-02 accused'] },
  { name: 'CS-02 deceased 81 characters', change: (s) => { s.deceased = 'b'.repeat(81); }, want: ['CS-02 deceased'] },
  { name: 'CS-02 act_alleged 101 words', change: (s) => { s.act_alleged = words(101); }, want: ['CS-02 act_alleged'] },
  { name: 'CS-02 base_premises 199 words', change: (s) => { s.base_premises = words(199); }, want: ['CS-02 base_premises'] },
  { name: 'CS-02 base_premises 301 words', change: (s) => { s.base_premises = words(301); }, want: ['CS-02 base_premises'] },
  { name: 'CS-03 nine items', change: (s) => { s.agreed_record = Array.from({ length: 9 }, () => 'A fact.'); }, want: ['CS-03 agreed_record'] },
  { name: 'CS-03 item of 121 words', change: (s) => { s.agreed_record = ['A fact.', words(121)]; }, want: ['CS-03 agreed_record'] },
  { name: 'CS-04 no question mark', change: (s) => { s.question = 'Jon killed Daenerys and that was justified.'; }, want: ['CS-04 question'] },
  { name: 'CS-04 121 words', change: (s) => { s.question = `${words(120)} ?`; }, want: ['CS-04 question'] },
  { name: 'CS-05 scope_note sent', change: (s) => { s.scope_note = 'anything'; }, want: ['CS-05 scope_note'] },
  { name: 'CS-05 case_id sent', change: (s) => { s.case_id = 'T-002'; }, want: ['CS-05 case_id'] },
];

for (const v of variants) {
  test(`constructed: ${v.name}`, () => {
    const s = filed();
    v.change(s);
    assert.deepEqual(pairs(failuresOf(s)), v.want);
  });
}

test('boundary values inside the bounds pass', () => {
  const s = filed();
  s.accused = 'a'.repeat(80);
  s.deceased = 'b';
  s.act_alleged = words(100);
  s.base_premises = words(200);
  s.agreed_record = Array.from({ length: 8 }, () => words(120));
  s.question = `${words(119)} what?`;
  const result = validateChargeSheet(s);
  assert.equal(result.ok, true, JSON.stringify(result));
  const t = filed();
  t.base_premises = words(300);
  t.agreed_record = ['one', 'two'];
  t.question = 'Why?';
  assert.equal(validateChargeSheet(t).ok, true);
});

test('stamping T-001 as filed equals T-001 as stored, exactly', () => {
  const stored = readJson('charge-sheets', 'T-001.stored.json');
  const result = validateChargeSheet(filed());
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('unreachable');
  const stamped = stampChargeSheet(result.sheet, 'T-001');
  assert.deepEqual(stamped, stored);
});

test('stamping adds exactly the three system fields with the canonical values', () => {
  const result = validateChargeSheet(filed());
  if (!result.ok) throw new Error('unreachable');
  const stamped = stampChargeSheet(result.sheet, 'T-001') as unknown as Record<string, unknown>;
  assert.equal(stamped.case_id, 'T-001');
  assert.match(String(stamped.case_id), /^T-[0-9]{3}$/);
  assert.deepEqual(stamped.verdict_values, ['justified', 'not_justified']);
  assert.equal(
    stamped.scope_note,
    'The Tribunal decides justified or not justified and gives reasons. It does not impose a sentence and does not combine the three opinions into one verdict.',
  );
  assert.deepEqual(
    Object.keys(stamped).sort(),
    ['accused', 'act_alleged', 'agreed_record', 'base_premises', 'case_id', 'deceased', 'question', 'scope_note', 'verdict_values'],
  );
  for (const k of Object.keys(result.sheet)) {
    assert.deepEqual(stamped[k], (result.sheet as unknown as Record<string, unknown>)[k], `${k} changed by stamping`);
  }
});

test('stamping does not mutate the validated sheet', () => {
  const result = validateChargeSheet(filed());
  if (!result.ok) throw new Error('unreachable');
  const before = JSON.stringify(result.sheet);
  stampChargeSheet(result.sheet, 'T-001');
  assert.equal(JSON.stringify(result.sheet), before);
});

test('word counts are whitespace-separated tokens: multiple spaces and newlines do not add words', () => {
  const s = filed();
  s.act_alleged = `${words(100)}`.replace(/ /g, '  \n');
  assert.equal(validateChargeSheet(s).ok, true, '100 tokens separated by mixed whitespace must pass');
  const t = clone(s);
  t.act_alleged = `${words(101)}`.replace(/ /g, '\n');
  assert.deepEqual(pairs(failuresOf(t)), ['CS-02 act_alleged']);
});

test('CS-06: a non-object submission fails on the whole value', () => {
  for (const input of [null, 'text', 42, ['a']]) {
    assert.deepEqual(pairs(failuresOf(input)), ['CS-06 $'], JSON.stringify(input));
  }
});

test('CS-06: a wrongly typed field fails CS-06, not CS-01', () => {
  const f = pairs(failuresOf({ ...filed(), accused: 7 }));
  assert.ok(f.includes('CS-06 accused'), f.join(', '));
  assert.ok(!f.includes('CS-01 accused'), f.join(', '));
});
