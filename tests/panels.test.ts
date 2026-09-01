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

test('the free fallback chain is ordered, free-only, and starts from the single panel model', () => {
  const chain: string[] = panels.free_fallbacks;
  assert.ok(chain.length >= 3);
  for (const m of chain) assert.match(m, /:free$/, m);
  assert.equal(chain[0], panels.single.jon, 'the chain starts where the single panel starts');
  assert.equal(new Set(chain).size, chain.length, 'no duplicates');
});
