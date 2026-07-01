export function resolveAttack({ damage, critChance = 0, dodgeChance = 0 }, rng) {
  if (rng() < dodgeChance) {
    return { hit: false, damage: 0, crit: false };
  }
  const isCrit = rng() < critChance;
  const variance = 0.85 + rng() * 0.3;
  const finalDamage = Math.round(damage * variance * (isCrit ? 1.5 : 1));
  return { hit: true, damage: finalDamage, crit: isCrit };
}

export function tickStatuses(statuses) {
  let totalDamage = 0;
  const remaining = [];
  for (const status of statuses) {
    totalDamage += status.damagePerTick;
    const turnsRemaining = status.turnsRemaining - 1;
    if (turnsRemaining > 0) remaining.push({ ...status, turnsRemaining });
  }
  return { totalDamage, remaining };
}
