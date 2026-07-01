export type SfxId = 'hit' | 'crit' | 'miss' | 'death' | 'levelUp' | 'pickup' | 'trap' | 'stairs';

let muted = false;
let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, duration: number, type: OscillatorType, gainPeak: number, delay = 0): void {
  const audioCtx = getContext();
  if (!audioCtx || muted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const startTime = audioCtx.currentTime + delay;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

const SFX: Record<SfxId, () => void> = {
  hit: () => tone(220, 0.08, 'square', 0.15),
  crit: () => { tone(320, 0.1, 'square', 0.2); tone(180, 0.12, 'square', 0.15, 0.04); },
  miss: () => tone(140, 0.06, 'triangle', 0.08),
  death: () => { tone(200, 0.2, 'sawtooth', 0.15); tone(100, 0.3, 'sawtooth', 0.12, 0.1); },
  levelUp: () => { tone(440, 0.1, 'sine', 0.15); tone(660, 0.15, 'sine', 0.15, 0.1); },
  pickup: () => tone(660, 0.08, 'sine', 0.1),
  trap: () => tone(90, 0.15, 'sawtooth', 0.18),
  stairs: () => { tone(300, 0.1, 'sine', 0.1); tone(400, 0.1, 'sine', 0.1, 0.08); },
};

export function playSound(id: SfxId): void {
  SFX[id]();
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}
