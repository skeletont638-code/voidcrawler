import type { RngFn, ShakeState, Particle, FloatingText, TweenState, FxState } from './types.js';

export function createShake(intensity: number, duration: number): ShakeState {
  return { intensity, duration, elapsed: 0 };
}

export function updateShake(shake: ShakeState | null, dt: number): ShakeState | null {
  if (!shake) return null;
  shake.elapsed += dt;
  return shake.elapsed >= shake.duration ? null : shake;
}

export function getShakeOffset(shake: ShakeState | null): { x: number; y: number } {
  if (!shake) return { x: 0, y: 0 };
  const progress = 1 - shake.elapsed / shake.duration;
  const magnitude = shake.intensity * progress;
  return { x: (Math.random() * 2 - 1) * magnitude, y: (Math.random() * 2 - 1) * magnitude };
}

export function createParticleBurst(x: number, y: number, count: number, rng: RngFn): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const speed = 20 + rng() * 40;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.5 });
  }
  return particles;
}

export function updateParticles(particles: Particle[], dt: number): Particle[] {
  return particles
    .map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, life: p.life - dt }))
    .filter((p) => p.life > 0);
}

export function createFloatingText(x: number, y: number, text: string, color: string): FloatingText {
  return { x, y, text, color, life: 0.8, vy: -30 };
}

export function updateFloatingTexts(texts: FloatingText[], dt: number): FloatingText[] {
  return texts.map((t) => ({ ...t, y: t.y + t.vy * dt, life: t.life - dt })).filter((t) => t.life > 0);
}

export function createTween(
  from: { x: number; y: number },
  to: { x: number; y: number },
  duration: number,
): TweenState {
  return { from, to, duration, elapsed: 0 };
}

export function updateTween(tween: TweenState | null, dt: number): TweenState | null {
  if (!tween) return null;
  tween.elapsed += dt;
  return tween.elapsed >= tween.duration ? null : tween;
}

export function getTweenPosition(tween: TweenState | null): { x: number; y: number } | null {
  if (!tween) return null;
  const t = Math.min(1, tween.elapsed / tween.duration);
  return {
    x: tween.from.x + (tween.to.x - tween.from.x) * t,
    y: tween.from.y + (tween.to.y - tween.from.y) * t,
  };
}

export function drawFx(ctx: CanvasRenderingContext2D, fxState: FxState): void {
  for (const p of fxState.particles) {
    ctx.fillStyle = '#e06030';
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  for (const t of fxState.floatingTexts) {
    ctx.globalAlpha = Math.max(0, t.life / 0.8);
    ctx.fillStyle = t.color;
    ctx.font = '12px monospace';
    ctx.fillText(t.text, t.x, t.y);
    ctx.globalAlpha = 1.0;
  }
}
