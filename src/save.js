const SAVE_KEY = 'voidcrawler-meta-v1';

const DEFAULT_META = {
  currency: 0,
  unlockedClasses: ['adventurer'],
  unlockedPerks: [],
};

export function loadMeta(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_META };
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_META };
    return { ...DEFAULT_META, ...parsed };
  } catch {
    return { ...DEFAULT_META };
  }
}

export function saveMeta(meta, storage = globalThis.localStorage) {
  storage.setItem(SAVE_KEY, JSON.stringify(meta));
}

export function applyRunResult(meta, { floorReached, kills }) {
  const earned = floorReached * 10 + kills * 2;
  return { updated: { ...meta, currency: meta.currency + earned }, earned };
}
