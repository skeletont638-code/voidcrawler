import { STARTING_CLASSES } from './data.js';
import type { MetaProgression, StorageLike } from './types.js';

const SAVE_KEY = 'voidcrawler-meta-v1';

const DEFAULT_META: MetaProgression = {
  currency: 0,
  unlockedClasses: ['adventurer'],
  unlockedPerks: [],
  mutedAudio: false,
};

export function loadMeta(storage: StorageLike = globalThis.localStorage): MetaProgression {
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

export function saveMeta(meta: MetaProgression, storage: StorageLike = globalThis.localStorage): void {
  storage.setItem(SAVE_KEY, JSON.stringify(meta));
}

export function applyRunResult(
  meta: MetaProgression,
  { floorReached, kills }: { floorReached: number; kills: number },
): { updated: MetaProgression; earned: number } {
  const earned = floorReached * 10 + kills * 2;
  return { updated: { ...meta, currency: meta.currency + earned }, earned };
}

export function purchaseClass(
  meta: MetaProgression,
  classId: string,
): { updated: MetaProgression; success: boolean; reason?: string } {
  const startingClass = STARTING_CLASSES[classId];
  if (!startingClass) {
    return { updated: meta, success: false, reason: 'unknown class' };
  }
  if (meta.unlockedClasses.includes(classId)) {
    return { updated: meta, success: false, reason: 'already unlocked' };
  }
  if (meta.currency < startingClass.unlockCost) {
    return { updated: meta, success: false, reason: 'insufficient currency' };
  }
  return {
    updated: {
      ...meta,
      currency: meta.currency - startingClass.unlockCost,
      unlockedClasses: [...meta.unlockedClasses, classId],
    },
    success: true,
  };
}
