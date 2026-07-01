import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMeta, saveMeta, applyRunResult } from '../src/save.js';

function fakeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
  };
}

test('loadMeta returns defaults when storage is empty', () => {
  const meta = loadMeta(fakeStorage());
  assert.equal(meta.currency, 0);
  assert.deepEqual(meta.unlockedClasses, ['adventurer']);
});

test('loadMeta falls back to defaults on corrupted JSON', () => {
  const storage = fakeStorage({ 'voidcrawler-meta-v1': 'not json{{' });
  const meta = loadMeta(storage);
  assert.equal(meta.currency, 0);
});

test('saveMeta then loadMeta round-trips', () => {
  const storage = fakeStorage();
  saveMeta({ currency: 42, unlockedClasses: ['adventurer'], unlockedPerks: ['tough'] }, storage);
  const meta = loadMeta(storage);
  assert.equal(meta.currency, 42);
  assert.deepEqual(meta.unlockedPerks, ['tough']);
});

test('applyRunResult adds currency proportional to floor and kills', () => {
  const meta = { currency: 10, unlockedClasses: ['adventurer'], unlockedPerks: [] };
  const { updated, earned } = applyRunResult(meta, { floorReached: 3, kills: 5 });
  assert.equal(earned, 3 * 10 + 5 * 2);
  assert.equal(updated.currency, 10 + earned);
});
