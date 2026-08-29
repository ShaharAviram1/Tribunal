import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'fixtures');
const listJson = (dir: string) => readdirSync(join(root, dir)).filter((f) => f.endsWith('.json'));
const load = (dir: string, f: string) => JSON.parse(readFileSync(join(root, dir, f), 'utf8'));

test('every JSON fixture parses', () => {
  for (const dir of ['charge-sheets', 'charge-sheets/invalid', 'stances', 'stances/invalid', 'opinions', 'opinions/invalid']) {
    for (const f of listJson(dir)) assert.doesNotThrow(() => load(dir, f), `${dir}/${f}`);
  }
});

test('T-001 as filed has exactly the six filer fields', () => {
  const filed = load('charge-sheets', 'T-001.filed.json');
  assert.deepEqual(Object.keys(filed).sort(), ['accused', 'act_alleged', 'agreed_record', 'base_premises', 'deceased', 'question']);
});

test('T-001 as stored adds exactly the three stamped fields', () => {
  const filed = load('charge-sheets', 'T-001.filed.json');
  const stored = load('charge-sheets', 'T-001.stored.json');
  assert.deepEqual(Object.keys(stored).sort(), [...Object.keys(filed), 'case_id', 'scope_note', 'verdict_values'].sort());
  assert.deepEqual(stored.verdict_values, ['justified', 'not_justified']);
});

test('one invalid charge sheet fixture per rule CS-01 to CS-05', () => {
  const names = listJson('charge-sheets/invalid');
  for (const code of ['CS-01', 'CS-02', 'CS-03', 'CS-04', 'CS-05']) {
    assert.ok(names.some((n) => n.startsWith(code)), `missing fixture for ${code}`);
  }
});

test('stored stance ids are role.pN by index', () => {
  const s = load('stances', 'greyworm.stored.json');
  s.points.forEach((p: { id: string }, i: number) => assert.equal(p.id, `greyworm.p${i + 1}`));
});
