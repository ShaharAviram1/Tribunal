import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assemblePrompt, ADVOCATES, JUDGES } from '../src/prompt/assemble.ts';

const chargeSheet = JSON.parse(readFileSync(join(process.cwd(), 'fixtures/charge-sheets/T-001.stored.json'), 'utf8'));
const stance = JSON.parse(readFileSync(join(process.cwd(), 'fixtures/stances/greyworm.stored.json'), 'utf8'));
const stances = [stance, stance, stance, stance];

const all = () => [
  ...ADVOCATES.map((r) => assemblePrompt({ role_id: r, chargeSheet })),
  ...JUDGES.map((r) => assemblePrompt({ role_id: r, chargeSheet, stances })),
];

test('first block is byte-identical across all seven prompts', () => {
  const prompts = all();
  assert.equal(prompts.length, 7);
  const first = Buffer.from(prompts[0]!.blocks[0]!, 'utf8');
  for (const p of prompts) {
    assert.ok(Buffer.from(p.blocks[0]!, 'utf8').equals(first), `${p.role_id} first block differs`);
    assert.ok(p.text.startsWith(p.blocks[0]!), `${p.role_id} does not start with the charge sheet block`);
  }
});

test('prompts are read from disk: editing a role file changes only that prompt', () => {
  const before = all();
  const copy = mkdtempSync(join(tmpdir(), 'tribunal-prompts-'));
  cpSync(join(process.cwd(), 'prompts'), copy, { recursive: true });
  const file = join(copy, 'greyworm.md');
  writeFileSync(file, readFileSync(file, 'utf8') + '\nEdited for the test.\n');
  const after = [
    ...ADVOCATES.map((r) => assemblePrompt({ role_id: r, chargeSheet, promptsDir: copy })),
    ...JUDGES.map((r) => assemblePrompt({ role_id: r, chargeSheet, stances, promptsDir: copy })),
  ];
  for (let i = 0; i < 7; i++) {
    const changed = before[i]!.hash !== after[i]!.hash;
    assert.equal(changed, before[i]!.role_id === 'greyworm', `${before[i]!.role_id} hash changed=${changed}`);
  }
});

test('hash is of the assembled text and differs on a corrective retry', () => {
  const a = assemblePrompt({ role_id: 'jon', chargeSheet });
  const b = assemblePrompt({ role_id: 'jon', chargeSheet, corrective: 'Previous attempt failed: position outside the set.' });
  assert.equal(a.hash.length, 64);
  assert.notEqual(a.hash, b.hash);
  assert.ok(b.text.startsWith(a.text), 'blocks before the corrective block are unchanged on retry');
});

test('judge prompts carry the preamble and stances; advocate prompts carry neither', () => {
  for (const p of all()) {
    const isJudge = (JUDGES as readonly string[]).includes(p.role_id);
    assert.equal(p.text.includes('you rule alone'), isJudge, p.role_id);
    assert.equal(p.text.includes('Advocate stances'), isJudge, p.role_id);
  }
});

test('no assembled prompt contains a header, a version, a jurist name, or its own role id', () => {
  for (const p of all()) {
    for (const bad of ['<!--', 'version:', 'Barak', 'Elon', 'Shamgar', 'profile:']) {
      assert.ok(!p.text.includes(bad), `${p.role_id} contains "${bad}"`);
    }
    assert.ok(!p.text.includes(`role_id: ${p.role_id}`), `${p.role_id} sees its own role id`);
    assert.ok(!p.text.includes(`"role_id": "${p.role_id}"`), `${p.role_id} sees its own role id`);
  }
});
