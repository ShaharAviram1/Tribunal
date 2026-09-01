import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateStance } from '../../src/protocol/validate-stance.ts';
import { validateOpinion } from '../../src/protocol/validate-opinion.ts';

const stance = readFileSync('fixtures/stances/greyworm.emitted.json', 'utf8');
const opinion = readFileSync('fixtures/opinions/judge-3.emitted.json', 'utf8');
const ids = ['greyworm.p2', 'daenerys.p1', 'greyworm.p3', 'jon.p1'];

test('a stance in a ```json fence parses: the fence is an envelope, not a value', () => {
  const r = validateStance('```json\n' + stance + '\n```');
  assert.equal(r.ok, true);
});

test('a bare ``` fence also unwraps, for opinions too', () => {
  const r = validateOpinion('```\n' + opinion + '\n```', ids);
  assert.equal(r.ok, true);
});

test('a fence around garbage is still malformed; only the envelope was stripped', () => {
  const r = validateStance('```json\nGrey Worm does not speak in lists.\n```');
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.detail, /not a parseable JSON object/);
});

test('an empty response is named as empty, not as unparseable', () => {
  const r = validateStance('');
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.detail, /response was empty/);
});

test('an unterminated fence is not unwrapped', () => {
  const r = validateStance('```json\n{"position":"justified"');
  assert.equal(r.ok, false);
});
