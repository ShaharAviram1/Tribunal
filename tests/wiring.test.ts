// A client constructed without roleFallbacks silently disables per-role reassignment: the
// drills, the spec, and the page all describe behaviour the wiring then does not have. Found
// by the second blind verification run, 2026-09-02, after the multi deliberation's zero
// retries meant no live run had ever needed the path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the background function hands role_fallbacks to the client it constructs', () => {
  const src = readFileSync('netlify/functions/tribunal-run-background.mts', 'utf8');
  assert.match(src, /roleFallbacks/, 'ModelClient must be constructed with roleFallbacks');
});

test('the live-run script hands role_fallbacks to the client it constructs', () => {
  const src = readFileSync('scripts/run-live.ts', 'utf8');
  assert.match(src, /roleFallbacks/, 'ModelClient must be constructed with roleFallbacks');
});
