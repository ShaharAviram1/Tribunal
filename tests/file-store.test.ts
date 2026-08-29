import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileStore } from '../src/store/file-store.ts';

test('budget is the sum of rows on disk; a second store instance sees it', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tribunal-store-'));
  const a = new FileStore(root, 'd-1');
  await a.add({ cost_usd: 0.25 } as never); await a.add({ cost_usd: 0.5 } as never);
  const b = new FileStore(root, 'd-1');
  assert.deepEqual(await b.read(), { calls: 2, spend_usd: 0.75 });
});

test('claim refuses a live claim and accepts a stale one', () => {
  const root = mkdtempSync(join(tmpdir(), 'tribunal-store-'));
  const fresh = new FileStore(root, 'd-2', 1000);
  assert.equal(fresh.claim(), true);
  assert.equal(new FileStore(root, 'd-2', 1000).claim(), false, 'claimed and not stale');
  assert.equal(new FileStore(root, 'd-2', 0).claim(), true, 'stale claim is taken');
});

test('a terminal job can be re-claimed', () => {
  const root = mkdtempSync(join(tmpdir(), 'tribunal-store-'));
  const s = new FileStore(root, 'd-3');
  s.claim(); s.putJob({ status: 'complete' });
  assert.equal(new FileStore(root, 'd-3').claim(), true);
});
