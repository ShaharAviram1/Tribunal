// Advocate stance validation and ingest, derived from docs/advocate-stance.schema.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateStance } from '../../src/protocol/validate-stance.ts';
import { ingestStance } from '../../src/protocol/ingest-stance.ts';
import { readJson, readText, listDir, clone, words, ADVOCATE_SEATS } from './_fixtures.ts';

type Point = { claim: string; support: string };
type Emitted = { position: string; points: Point[] };

const emitted = () => readJson<Emitted>('stances', 'greyworm.emitted.json');
const emittedText = () => readText('stances', 'greyworm.emitted.json');

const reject = (raw: string) => {
  const result = validateStance(raw);
  assert.equal(result.ok, false, `expected rejection, got ${JSON.stringify(result)}`);
  if (result.ok) throw new Error('unreachable');
  return result;
};

// Section 3 and section 6: the kind each invalid fixture maps to.
const expected: Record<string, 'malformed' | 'refusal'> = {
  'not-json.txt': 'malformed',
  'extra-field.json': 'malformed',
  'position-outside-set.json': 'malformed',
  'too-few-points.json': 'malformed',
  'claim-over-bound.json': 'malformed',
  'refusal.txt': 'malformed', // prose is never classified as a refusal (schema §3)
};

test('every invalid stance fixture has an expectation', () => {
  for (const name of listDir('stances', 'invalid')) {
    assert.ok(name in expected, `no expectation written for fixture ${name}`);
  }
});

for (const [name, kind] of Object.entries(expected)) {
  test(`invalid/${name} is rejected as ${kind}`, () => {
    const result = reject(readText('stances', 'invalid', name));
    assert.equal(result.kind, kind);
    assert.equal(typeof result.detail, 'string');
    assert.ok(result.detail.length > 0, 'detail must name what failed');
  });
}

test('a malformed detail names the failing field', () => {
  assert.match(reject(readText('stances', 'invalid', 'extra-field.json')).detail, /confidence/);
  assert.match(reject(readText('stances', 'invalid', 'position-outside-set.json')).detail, /position/);
  assert.match(reject(readText('stances', 'invalid', 'too-few-points.json')).detail, /points/);
  assert.match(reject(readText('stances', 'invalid', 'claim-over-bound.json')).detail, /claim/);
});

test('the valid emitted fixture passes and is returned unchanged', () => {
  const result = validateStance(emittedText());
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) throw new Error('unreachable');
  assert.deepEqual(result.stance, emitted());
});

test('the emitted object carries no ids: the model emits none', () => {
  for (const p of emitted().points) assert.ok(!('id' in p));
});

test('ingest of the emitted fixture equals the stored fixture', () => {
  const result = validateStance(emittedText());
  if (!result.ok) throw new Error('unreachable');
  const stored = ingestStance(result.stance, 'greyworm', 'prosecution', 'd-0001');
  assert.deepEqual(stored, readJson('stances', 'greyworm.stored.json'));
});

test('ingest assigns <role_id>.p<n> from 1 in array order for every role', () => {
  const result = validateStance(emittedText());
  if (!result.ok) throw new Error('unreachable');
  for (const [role_id, seat] of ADVOCATE_SEATS) {
    const stored = ingestStance(result.stance, role_id, seat, 'd-0002') as unknown as {
      role_id: string; seat: string; deliberation_id: string; position: string; points: Array<Point & { id: string }>;
    };
    assert.equal(stored.role_id, role_id);
    assert.equal(stored.seat, seat);
    assert.equal(stored.deliberation_id, 'd-0002');
    assert.equal(stored.position, result.stance.position);
    stored.points.forEach((p, i) => {
      assert.equal(p.id, `${role_id}.p${i + 1}`);
      assert.equal(p.claim, result.stance.points[i]!.claim);
      assert.equal(p.support, result.stance.points[i]!.support);
    });
    assert.deepEqual(Object.keys(stored).sort(), ['deliberation_id', 'points', 'position', 'role_id', 'seat']);
  }
});

test('ingest does not mutate the emitted stance', () => {
  const result = validateStance(emittedText());
  if (!result.ok) throw new Error('unreachable');
  const before = JSON.stringify(result.stance);
  ingestStance(result.stance, 'jon', 'defense', 'd-0001');
  assert.equal(JSON.stringify(result.stance), before);
});

// Constructed instances for the rejection conditions of section 1 and 3 not covered by a fixture file.
const malformedVariants: Array<{ name: string; change: (s: Emitted) => unknown }> = [
  { name: 'position missing', change: (s) => { const o = s as Partial<Emitted>; delete o.position; return o; } },
  { name: 'points missing', change: (s) => { const o = s as Partial<Emitted>; delete o.points; return o; } },
  { name: 'position with trailing whitespace', change: (s) => { s.position = 'not_justified '; return s; } },
  { name: 'position capitalised', change: (s) => { s.position = 'Justified'; return s; } },
  { name: 'position with space', change: (s) => { s.position = 'not justified'; return s; } },
  { name: 'six points', change: (s) => { s.points = [...s.points, ...s.points]; return s; } },
  { name: 'claim empty after trimming', change: (s) => { s.points[0]!.claim = '  '; return s; } },
  { name: 'support empty after trimming', change: (s) => { s.points[1]!.support = ''; return s; } },
  { name: 'claim of 41 words', change: (s) => { s.points[0]!.claim = words(41); return s; } },
  { name: 'support of 201 words', change: (s) => { s.points[2]!.support = words(201); return s; } },
  { name: 'point with an extra field', change: (s) => { (s.points[0] as Record<string, unknown>).id = 'greyworm.p1'; return s; } },
  { name: 'point missing support', change: (s) => { delete (s.points[0] as Partial<Point>).support; return s; } },
  { name: 'JSON array rather than object', change: (s) => [s] },
  { name: 'JSON string rather than object', change: () => 'not_justified' },
];

for (const v of malformedVariants) {
  test(`constructed malformed: ${v.name}`, () => {
    const result = reject(JSON.stringify(v.change(clone(emitted()))));
    assert.equal(result.kind, 'malformed');
  });
}

test('constructed malformed: empty response and code-fenced JSON', () => {
  assert.equal(reject('').kind, 'malformed');
  assert.equal(reject('   \n').kind, 'malformed');
  assert.equal(reject('```json\n' + emittedText() + '\n```').kind, 'malformed');
});

test('constructed valid: exactly five points, claim of 40 words, support of 200 words', () => {
  const s = clone(emitted());
  s.points = [...s.points, clone(s.points[0]!), clone(s.points[1]!)];
  s.points[0]!.claim = words(40);
  s.points[0]!.support = words(200);
  const result = validateStance(JSON.stringify(s));
  assert.equal(result.ok, true, JSON.stringify(result));
  const j = clone(emitted());
  j.position = 'justified';
  assert.equal(validateStance(JSON.stringify(j)).ok, true);
});
