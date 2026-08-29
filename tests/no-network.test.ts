import { test } from 'node:test';
import assert from 'node:assert/strict';

test('the suite runs without a key', () => {
  assert.equal(process.env.OPENROUTER_API_KEY, undefined);
});

test('a test that reaches the network fails', () => {
  assert.throws(() => fetch('https://openrouter.ai/api/v1/models'), /reached the network/);
});
