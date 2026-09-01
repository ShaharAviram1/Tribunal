import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROLES = ['jon', 'tyrion', 'daenerys', 'greyworm', 'judge-1', 'judge-2', 'judge-3'].sort();
const panels = JSON.parse(readFileSync('config/models.json', 'utf8'));

test('both panels cover exactly the seven roles with real model ids', () => {
  for (const name of ['single', 'multi']) {
    assert.deepEqual(Object.keys(panels[name]).sort(), ROLES, name);
    for (const m of Object.values(panels[name]) as string[]) assert.match(m, /^[a-z0-9-]+\/.+$/, `${name}: ${m}`);
  }
});

test('single is one model for all seven roles', () => {
  assert.equal(new Set(Object.values(panels.single)).size, 1);
});

test('multi is seven distinct models, no two roles sharing one', () => {
  assert.equal(new Set(Object.values(panels.multi)).size, 7);
});

test('paid only: no free model holds any seat or fallback, and the free chain is empty', () => {
  // Decision, 2026-09-01: free models proved slow and flaky in probes and production, and the
  // whole roster went paid. The chain stays as a mechanism with nothing to rotate through.
  assert.deepEqual(panels.free_fallbacks, []);
  const everywhere = [
    ...Object.values(panels.single) as string[],
    ...Object.values(panels.multi) as string[],
    panels.intake as string,
    ...(Object.values(panels.role_fallbacks) as string[][]).flat(),
  ];
  for (const m of everywhere) assert.ok(!m.endsWith(':free'), `free model still present: ${m}`);
});
