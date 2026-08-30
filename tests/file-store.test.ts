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

test('claim: pending claimable, running with fresh heartbeat not, running stale yes, terminal never', () => {
  const root = mkdtempSync(join(tmpdir(), 'tribunal-store-'));
  const s = new FileStore(root, 'd-2', 60000);
  assert.equal(s.claim(), true, 'no job yet: claimable');
  s.putJob({ status: 'running', heartbeat_at: new Date().toISOString() });
  assert.equal(new FileStore(root, 'd-2', 60000).claim(), false, 'running with fresh heartbeat');
  s.putJob({ status: 'running', heartbeat_at: new Date(Date.now() - 120000).toISOString() });
  assert.equal(new FileStore(root, 'd-2', 60000).claim(), true, 'running with stale heartbeat');
  for (const status of ['complete', 'incomplete', 'failed']) {
    s.putJob({ status, heartbeat_at: new Date(0).toISOString() });
    assert.equal(new FileStore(root, 'd-2', 60000).claim(), false, `terminal ${status} must never be claimable`);
  }
});
