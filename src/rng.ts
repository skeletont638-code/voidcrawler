import type { RngFn } from './types.js';

export function createRng(seed: number): RngFn {
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return function rng() {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}
