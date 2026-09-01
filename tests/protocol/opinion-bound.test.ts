import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateOpinion } from '../../src/protocol/validate-opinion.ts';

const base = JSON.parse(readFileSync('fixtures/opinions/judge-3.emitted.json', 'utf8'));
const ids = ['greyworm.p2', 'daenerys.p1', 'greyworm.p3', 'jon.p1'];
const words = (n: number) => Array.from({ length: n }, (_, i) => 'w' + i).join(' ');

test('a reason over 90 words is malformed and the detail names the count', () => {
  const o = { ...base, reasons: [{ text: words(91), relies_on: ['jon.p1'] }, base.reasons[1]] };
  const r = validateOpinion(JSON.stringify(o), ids);
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.kind, 'malformed'); assert.match(r.detail, /91 words, at most 90/); }
});

test('a counter-consideration over 90 words is malformed', () => {
  const o = { ...base, against: { text: words(95), relies_on: [] } };
  const r = validateOpinion(JSON.stringify(o), ids);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.detail, /against.text is 95 words/);
});

test('exactly 90 words passes', () => {
  const o = { ...base, reasons: [{ text: words(90), relies_on: ['jon.p1'] }, base.reasons[1]], against: { text: words(90), relies_on: [] } };
  const r = validateOpinion(JSON.stringify(o), ids);
  assert.equal(r.ok, true);
});
