export function createShake(intensity, duration) {
  return { intensity, duration, elapsed: 0 };
}

export function updateShake(shake, dt) {
  if (!shake) return null;
  shake.elapsed += dt;
  return shake.elapsed >= shake.duration ? null : shake;
}

export function getShakeOffset(shake) {
  if (!shake) return { x: 0, y: 0 };
  const progress = 1 - shake.elapsed / shake.duration;
  const magnitude = shake.intensity * progress;
  return { x: (Math.random() * 2 - 1) * magnitude, y: (Math.random() * 2 - 1) * magnitude };
}

export function createParticleBurst(x, y, count, rng) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const speed = 20 + rng() * 40;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.5 });
  }
  return particles;
}

export function updateParticles(particles, dt) {
  return particles
    .map(p => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, life: p.life - dt }))
    .filter(p => p.life > 0);
}

export function createFloatingText(x, y, text, color) {
  return { x, y, text, color, life: 0.8, vy: -30 };
}

export function updateFloatingTexts(texts, dt) {
  return texts
    .map(t => ({ ...t, y: t.y + t.vy * dt, life: t.life - dt }))
    .filter(t => t.life > 0);
}

export function createTween(from, to, duration) {
  return { from, to, duration, elapsed: 0 };
}

export function updateTween(tween, dt) {
  if (!tween) return null;
  tween.elapsed += dt;
  return tween.elapsed >= tween.duration ? null : tween;
}

export function getTweenPosition(tween) {
  if (!tween) return null;
  const t = Math.min(1, tween.elapsed / tween.duration);
  return {
    x: tween.from.x + (tween.to.x - tween.from.x) * t,
    y: tween.from.y + (tween.to.y - tween.from.y) * t,
  };
}

export function drawFx(ctx, fxState, tileSize) {
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
