// Sketch validation, derived solely from docs/representative-sketch.schema.md (rules SK-01..SK-05,
// the shape example, and the rejection-behaviour section), cross-read against docs/charge-sheet.spec.md
// (which the schema doc names as governing the sibling `charge_sheet` half and as the source of the
// "all failing rules reported together, nothing repaired" rejection convention shared by both halves),
// prompts/_intake.md (the exact JSON shape and the seat-to-figure convention: jon/tyrion take the
// defense seats, daenerys/greyworm the prosecution seats, in T-001's worked instance), and
// prompts/_contract.md's "The intake prompt" section (confirms `_intake.md` is never assembled into a
// panel prompt and that its output is "validated by rule code like every other model output"). Word
// counting follows the whitespace-token convention stated in both schema documents; src/protocol/types.ts
// was read ONLY to confirm that convention (`words = (s) => s.trim() === '' ? 0 : s.trim().split(/\s+/).length`).
//
// This suite was written from documents alone. src/protocol/validate-sketches.ts,
// netlify/functions/tribunal-intake.mts, and every other file under src/ (besides types.ts, read only
// for the word-counting convention above) were never opened while writing it.
//
// Scope boundary, out of this file: validateSketches(input) is given as taking already-*parsed*
// input -- a JS value, not raw model text. The fence-stripping rule (spec.md criterion 6, "fences"
// revision, 2026-09-01: "a single well-formed outer code fence is stripped from a model response
// before parsing") and the "not a parseable JSON object" corrective-retry path (spec.md criterion 6)
// belong to the layer that turns a raw model response into the `input` this function receives. They
// are a parsing-layer concern, not a validateSketches concern, and are not exercised here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSketches } from '../../src/protocol/validate-sketches.ts';

type Sketch = { name: string; seat: string; sketch: string };
type Result = ReturnType<typeof validateSketches>;

// Exactly n whitespace-separated tokens, for the SK-04 boundary fixtures (word count is the only
// thing under test there, so filler tokens are fine; the main valid-array fixture below uses real
// prose instead, per the instruction to build it with real words).
const nWords = (n: number): string => Array.from({ length: n }, (_, i) => `w${i + 1}`).join(' ');

// Real prose, one paragraph per figure named in T-001 (docs/charge-sheet.spec.md section 5), two
// defense and two prosecution, distinct names, each comfortably inside the 40-300 word band and
// containing none of the six jurist tokens (checked by hand: no whole-word match, case-insensitive,
// against Barak, Elon, Shamgar, Aharon, Menachem, Meir).
const JON =
  "Jon speaks plainly, in short declarative sentences, uncomfortable with flattery and slow to " +
  'explain himself even when explanation would help him. He values duty and the safety of people ' +
  'under his protection above his own reputation. Under pressure he goes quiet rather than ' +
  'argumentative, and he changes his mind only when someone he trusts shows him a cost he had not ' +
  'weighed, never when he is merely outargued.';
const TYRION =
  'Tyrion talks in irony and long, looping sentences that circle a point before landing on it, ' +
  'using wit as armor against a room that has mocked him since childhood. He values cleverness and ' +
  'loyalty repaid in kind, and prizes being useful where he cannot be loved. Under pressure he ' +
  'retreats into jokes that turn brittle, and he changes his mind only when a plan he built collapses ' +
  'in front of him and he can no longer talk around the wreckage.';
const DAENERYS =
  'Daenerys speaks with the cadence of someone used to being obeyed, alternating between warmth ' +
  'toward those who serve her and cold formality toward anyone she suspects of doubting her claim. ' +
  'She values liberation delivered on her own terms and has no patience for half measures. Under ' +
  'pressure she narrows the world into loyalty and betrayal with nothing between them, and she ' +
  'changes her mind only when someone she already trusts completely asks her directly, never when ' +
  'challenged in public.';
const GREYWORM =
  "Grey Worm speaks with clipped, disciplined economy, a soldier's habit from a childhood spent " +
  'being trained rather than raised. He values order, command, and the people he has fought beside ' +
  'above any abstract principle argued in a room he was not part of. Under pressure he falls back on ' +
  'the chain of command that shaped him, and he changes his mind only when the person at the top of ' +
  'that chain changes it for him, never through persuasion alone.';

const validFour = (): Sketch[] => [
  { name: 'Jon Snow', seat: 'defense', sketch: JON },
  { name: 'Tyrion Lannister', seat: 'defense', sketch: TYRION },
  { name: 'Daenerys Targaryen', seat: 'prosecution', sketch: DAENERYS },
  { name: 'Grey Worm', seat: 'prosecution', sketch: GREYWORM },
];

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const failuresOf = (input: unknown) => {
  const result: Result = validateSketches(input);
  assert.equal(result.ok, false, 'expected rejection');
  if (result.ok) throw new Error('unreachable');
  return result.failures;
};

const codesOf = (input: unknown): string[] => failuresOf(input).map((f) => f.code);

// ---------------------------------------------------------------------------------------------
// Valid input
// ---------------------------------------------------------------------------------------------

test('a valid four-sketch array (two per seat, distinct names, 40+ real words each) passes and is returned unchanged', () => {
  const input = validFour();
  const result = validateSketches(input);
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) throw new Error('unreachable');
  assert.deepEqual(result.sketches, input);
});

test('validation does not repair or mutate: the input object is untouched', () => {
  const input = validFour();
  const before = JSON.stringify(input);
  validateSketches(input);
  assert.equal(JSON.stringify(input), before);
});

// ---------------------------------------------------------------------------------------------
// SK-01: shape -- array of exactly 4 objects, each with exactly name/seat/sketch, right types
// ---------------------------------------------------------------------------------------------

test('SK-01: a non-array value is rejected', () => {
  for (const input of [null, undefined, {}, 'text', 42, true, { sketches: validFour() }]) {
    assert.ok(codesOf(input).includes('SK-01'), JSON.stringify(input));
  }
});

test('SK-01: three items (a seat left arguing as nobody) is rejected', () => {
  const three = validFour().slice(0, 3);
  assert.ok(codesOf(three).includes('SK-01'));
});

test('SK-01: five items (one unassigned) is rejected', () => {
  const five = [...validFour(), { name: 'Sansa Stark', seat: 'defense', sketch: JON }];
  assert.ok(codesOf(five).includes('SK-01'));
});

test('SK-01: a non-object item is rejected', () => {
  const four = validFour() as unknown[];
  four[2] = 'Daenerys Targaryen';
  assert.ok(codesOf(four).includes('SK-01'));
});

test('SK-01: an extra field on an item is rejected, and the failure detail names the field', () => {
  const four = validFour() as unknown as Record<string, unknown>[];
  (four[0] as Record<string, unknown>).aside = 'a private note';
  const failures = failuresOf(four);
  assert.ok(failures.some((f) => f.code === 'SK-01'), JSON.stringify(failures));
  assert.ok(
    failures.some((f) => f.detail.toLowerCase().includes('aside')),
    `expected a failure detail naming "aside": ${JSON.stringify(failures)}`,
  );
});

test('SK-01: a wrong-typed name is rejected', () => {
  const four = clone(validFour()) as unknown as Record<string, unknown>[];
  four[0]!.name = 42;
  assert.ok(codesOf(four).includes('SK-01'));
});

test('SK-01: a wrong-typed sketch is rejected', () => {
  const four = clone(validFour()) as unknown as Record<string, unknown>[];
  four[0]!.sketch = ['not', 'a', 'string'];
  assert.ok(codesOf(four).includes('SK-01'));
});

// ---------------------------------------------------------------------------------------------
// SK-02: exactly two per seat; seat is exactly "defense" or "prosecution"
// ---------------------------------------------------------------------------------------------

test("SK-02: a misspelled seat ('Defense', capitalized) is rejected", () => {
  const four = clone(validFour());
  four[0]!.seat = 'Defense';
  assert.ok(codesOf(four).includes('SK-02'));
});

test("SK-02: a misspelled seat ('plaintiff', not a seat at all) is rejected", () => {
  const four = clone(validFour());
  four[2]!.seat = 'plaintiff';
  assert.ok(codesOf(four).includes('SK-02'));
});

// The document's own failure-prevented column for SK-02 discusses "a 3-1 split" naming both seats,
// so a 3-1 split is at minimum one SK-02 failure. Whether the implementation emits one merged
// failure describing both seats' counts, or two separate SK-02 entries, is not settled by the
// document's wording ("all failing rules are reported together" speaks to distinct rule codes, not
// to how many entries one code may produce). This test checks only what is textually certain: SK-02
// fires, and the detail text -- taken as a whole across all reported failures -- speaks to both
// seats' counts, not just one.
test('SK-02: a 3-1 split (three defense, one prosecution) is rejected, naming both seats', () => {
  const four = clone(validFour());
  four[2]!.seat = 'defense'; // now defense: 3 (items 0,1,2), prosecution: 1 (item 3)
  const failures = failuresOf(four);
  assert.ok(failures.some((f) => f.code === 'SK-02'), JSON.stringify(failures));
  const allDetail = failures.map((f) => f.detail).join(' ').toLowerCase();
  assert.match(allDetail, /defense/, `expected some failure detail to mention "defense": ${allDetail}`);
  assert.match(allDetail, /prosecution/, `expected some failure detail to mention "prosecution": ${allDetail}`);
});

// ---------------------------------------------------------------------------------------------
// SK-03: name is 1-60 chars, non-empty after trimming, and the four names are distinct
// ---------------------------------------------------------------------------------------------

test('SK-03: an empty name is rejected', () => {
  const four = clone(validFour());
  four[0]!.name = '';
  assert.ok(codesOf(four).includes('SK-03'));
});

test('SK-03: a whitespace-only name is rejected ("non-empty after trimming")', () => {
  const four = clone(validFour());
  four[0]!.name = '    ';
  assert.ok(codesOf(four).includes('SK-03'));
});

test('SK-03: a 61-character name is rejected', () => {
  const four = clone(validFour());
  four[0]!.name = 'a'.repeat(61);
  assert.ok(codesOf(four).includes('SK-03'));
});

test('SK-03: a 60-character name passes (boundary)', () => {
  const four = clone(validFour());
  four[0]!.name = 'a'.repeat(60);
  const result = validateSketches(four);
  assert.equal(result.ok, true, JSON.stringify(result));
});

test('SK-03: an exact duplicate name across two sketches is rejected ("the four names are distinct")', () => {
  const four = clone(validFour());
  four[1]!.name = four[0]!.name;
  assert.ok(codesOf(four).includes('SK-03'));
});

// The document says only "the four names are distinct"; it does not say whether distinctness is
// case-sensitive. Two names that render identically to a reader up to case (e.g. a citation of
// either becomes just as ambiguous as an exact duplicate -- SK-03's own stated failure-prevented
// reason) argue for the stricter reading: distinctness is case-insensitive. This test encodes that
// stricter reading; if the implementation treats case-sensitive equality as sufficient distinctness,
// this is a finding about the document's silence, not a bug to paper over.
test('SK-03 (stricter reading): names duplicated only by case are rejected', () => {
  const four = clone(validFour());
  four[1]!.name = four[0]!.name.toUpperCase();
  assert.notEqual(four[0]!.name, four[1]!.name, 'fixture sanity: strings differ by case only');
  assert.ok(codesOf(four).includes('SK-03'));
});

// ---------------------------------------------------------------------------------------------
// SK-04: each sketch is 40-300 words (whitespace-separated tokens)
// ---------------------------------------------------------------------------------------------

test('SK-04: a 39-word sketch is rejected', () => {
  const four = clone(validFour());
  four[0]!.sketch = nWords(39);
  assert.ok(codesOf(four).includes('SK-04'));
});

test('SK-04: a 301-word sketch is rejected', () => {
  const four = clone(validFour());
  four[0]!.sketch = nWords(301);
  assert.ok(codesOf(four).includes('SK-04'));
});

test('SK-04: an exactly-40-word sketch passes (boundary)', () => {
  const four = clone(validFour());
  four[0]!.sketch = nWords(40);
  const result = validateSketches(four);
  assert.equal(result.ok, true, JSON.stringify(result));
});

test('SK-04: an exactly-300-word sketch passes (boundary)', () => {
  const four = clone(validFour());
  four[0]!.sketch = nWords(300);
  const result = validateSketches(four);
  assert.equal(result.ok, true, JSON.stringify(result));
});

// ---------------------------------------------------------------------------------------------
// SK-05: no field contains a real jurist's name, case-insensitive, as a whole word --
// Barak, Elon, Shamgar, Aharon, Menachem, Meir
// ---------------------------------------------------------------------------------------------

const JURISTS = ['Barak', 'Elon', 'Shamgar', 'Aharon', 'Menachem', 'Meir'];

for (const jurist of JURISTS) {
  test(`SK-05: "${jurist.toLowerCase()}" (lowercase) as an item's whole name is rejected`, () => {
    const four = clone(validFour());
    four[0]!.name = jurist.toLowerCase();
    assert.ok(codesOf(four).includes('SK-05'));
  });

  test(`SK-05: "${jurist.toUpperCase()}" (uppercase) as an item's whole name is rejected`, () => {
    const four = clone(validFour());
    four[0]!.name = jurist.toUpperCase();
    assert.ok(codesOf(four).includes('SK-05'));
  });

  test(`SK-05: "${jurist}" embedded as a whole word inside a sketch is rejected`, () => {
    const four = clone(validFour());
    four[0]!.sketch = `${JON} A witness named ${jurist} recalls it differently.`;
    assert.ok(codesOf(four).includes('SK-05'));
  });

  test(`SK-05: "${jurist.toUpperCase()}" embedded as a whole word inside a sketch is rejected (case-insensitive)`, () => {
    const four = clone(validFour());
    four[0]!.sketch = `${JON} A witness named ${jurist.toUpperCase()} recalls it differently.`;
    assert.ok(codesOf(four).includes('SK-05'));
  });
}

// "Whole word": a name/sketch merely containing a jurist token as a substring must pass. Tested in
// both directions (name field, sketch field) for both example words from the task ('belongs'
// contains 'elon'; 'Meirong' contains 'meir').
test("SK-05: 'Belongs' as a whole name passes (contains 'elon' only as a substring)", () => {
  const four = clone(validFour());
  four[0]!.name = 'Belongs';
  const result = validateSketches(four);
  assert.equal(result.ok, true, JSON.stringify(result));
});

test("SK-05: 'belongs' embedded in a sketch passes (contains 'elon' only as a substring)", () => {
  const four = clone(validFour());
  four[0]!.sketch = `${JON} Everything he owns belongs to his family, in his own account of it.`;
  const result = validateSketches(four);
  assert.equal(result.ok, true, JSON.stringify(result));
});

test("SK-05: 'Meirong' as a whole name passes (contains 'meir' only as a substring)", () => {
  const four = clone(validFour());
  four[0]!.name = 'Meirong';
  const result = validateSketches(four);
  assert.equal(result.ok, true, JSON.stringify(result));
});

test("SK-05: 'Meirong' embedded in a sketch passes (contains 'meir' only as a substring)", () => {
  const four = clone(validFour());
  four[0]!.sketch = `${JON} A neighbor called Meirong gave a separate account of that night.`;
  const result = validateSketches(four);
  assert.equal(result.ok, true, JSON.stringify(result));
});

// ---------------------------------------------------------------------------------------------
// Multiple failures reported together
// ---------------------------------------------------------------------------------------------

test('multiple failing rules (SK-02, SK-03, SK-04, SK-05) are reported together in one result, with SK-01 absent', () => {
  const four: Sketch[] = [
    { name: 'Barak', seat: 'defense', sketch: nWords(10) }, // SK-05 (name), SK-04 (10 words)
    { name: 'Tyrion Lannister', seat: 'defense', sketch: TYRION },
    { name: 'Daenerys Targaryen', seat: 'Prosecution', sketch: DAENERYS }, // SK-02 (misspelled seat)
    { name: 'Tyrion Lannister', seat: 'prosecution', sketch: GREYWORM }, // SK-03 (duplicate of item 1)
  ];
  const failures = failuresOf(four);
  const codes = new Set(failures.map((f) => f.code));
  assert.ok(failures.length >= 4, JSON.stringify(failures));
  assert.deepEqual(codes, new Set(['SK-02', 'SK-03', 'SK-04', 'SK-05']), JSON.stringify(failures));
  assert.ok(!codes.has('SK-01'), 'this fixture has 4 well-shaped items and should not trip SK-01');
});

test('every failure carries a code matching SK-0[1-5] and a non-empty detail string', () => {
  const four = clone(validFour());
  four[0]!.seat = 'Defense';
  four[1]!.sketch = nWords(5);
  for (const f of failuresOf(four)) {
    assert.match(f.code, /^SK-0[1-5]$/, JSON.stringify(f));
    assert.equal(typeof f.detail, 'string');
    assert.ok(f.detail.length > 0, JSON.stringify(f));
  }
});
