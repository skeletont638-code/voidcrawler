import { describe, it, expect } from 'vitest';
import { loadMeta, saveMeta, applyRunResult } from '../src/save.js';

function fakeStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = v; },
  };
}

describe('loadMeta', () => {
  it('returns defaults when storage is empty', () => {
    const meta = loadMeta(fakeStorage());
    expect(meta.currency).toBe(0);
    expect(meta.unlockedClasses).toEqual(['adventurer']);
  });

  it('falls back to defaults on corrupted JSON', () => {
    const storage = fakeStorage({ 'voidcrawler-meta-v1': 'not json{{' });
    expect(loadMeta(storage).currency).toBe(0);
  });
});

describe('saveMeta', () => {
  it('then loadMeta round-trips', () => {
    const storage = fakeStorage();
    saveMeta({ currency: 42, unlockedClasses: ['adventurer'], unlockedPerks: ['tough'] }, storage);
    const meta = loadMeta(storage);
    expect(meta.currency).toBe(42);
    expect(meta.unlockedPerks).toEqual(['tough']);
  });
});

describe('applyRunResult', () => {
  it('adds currency proportional to floor and kills', () => {
    const meta = { currency: 10, unlockedClasses: ['adventurer'], unlockedPerks: [] };
    const { updated, earned } = applyRunResult(meta, { floorReached: 3, kills: 5 });
    expect(earned).toBe(3 * 10 + 5 * 2);
    expect(updated.currency).toBe(10 + earned);
  });
});
