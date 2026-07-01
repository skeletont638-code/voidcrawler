import { XP_TABLE, PERK_POOL } from './data.js';
import type { StartingClass, MonsterArchetype, StatusEffect, Item, AttackStats, Perk } from './types.js';

export function xpForNextLevel(level: number): number {
  if (level < XP_TABLE.length) return XP_TABLE[level]!;
  return XP_TABLE[XP_TABLE.length - 1]! + (level - XP_TABLE.length + 1) * 100;
}

function pickThreePerks(): Perk[] {
  const pool = [...PERK_POOL];
  const picks: Perk[] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const index = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(index, 1)[0]!);
  }
  return picks;
}

export class Player {
  maxHp: number;
  hp: number;
  level = 1;
  xp = 0;
  str: number;
  dex: number;
  vit: number;
  perks: string[] = [];
  inventory: Item[] = [];
  equipment: { weapon: Item | null; armor: Item | null; accessory: Item | null } = {
    weapon: null,
    armor: null,
    accessory: null,
  };
  x = 0;
  y = 0;
  statuses: StatusEffect[] = [];

  constructor(startingClass: StartingClass) {
    this.maxHp = startingClass.baseHp;
    this.hp = this.maxHp;
    this.str = startingClass.str;
    this.dex = startingClass.dex;
    this.vit = startingClass.vit;
  }

  gainXp(amount: number): { leveled: boolean; perkChoices: Perk[] } {
    this.xp += amount;
    let leveled = false;
    let perkChoices: Perk[] = [];
    while (this.xp >= xpForNextLevel(this.level)) {
      this.xp -= xpForNextLevel(this.level);
      this.level += 1;
      this.maxHp += 5;
      this.hp = this.maxHp;
      leveled = true;
      if (this.level % 2 === 0) {
        perkChoices = pickThreePerks();
      }
    }
    return { leveled, perkChoices };
  }

  getAttackStats(): AttackStats {
    const weapon = this.equipment.weapon;
    const armor = this.equipment.armor;
    const weaponDamage = weapon
      ? weapon.affixes.reduce((sum, a) => sum + (a.key === 'damage' ? a.value : 0), weapon.baseDamage ?? 3)
      : 2 + this.str;
    const critChance =
      0.05 +
      this.dex * 0.01 +
      (weapon?.affixes ?? []).reduce((sum, a) => sum + (a.key === 'critChance' ? a.value : 0), 0);
    const dodgeChance =
      0.03 +
      this.dex * 0.005 +
      (armor?.affixes ?? []).reduce((sum, a) => sum + (a.key === 'resistance' ? a.value * 0.2 : 0), 0);
    return { damage: weaponDamage, critChance, dodgeChance };
  }

  getMaxHpBonus(): number {
    return this.equipment.accessory?.affixes.reduce((sum, a) => sum + (a.key === 'maxHp' ? a.value : 0), 0) ?? 0;
  }

  getXpMultiplier(): number {
    const bonus =
      this.equipment.accessory?.affixes.reduce((sum, a) => sum + (a.key === 'xpGain' ? a.value : 0), 0) ?? 0;
    return 1 + bonus;
  }
}

export class Monster {
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  state: 'idle' | 'aggro' | 'chase' | 'attack' | 'flee' = 'idle';
  statuses: StatusEffect[] = [];
  lastKnownPlayerPos: { x: number; y: number } | null = null;
  turnCounter = 0;

  constructor(
    public archetype: MonsterArchetype,
    x: number,
    y: number,
  ) {
    this.hp = archetype.hp;
    this.maxHp = archetype.hp;
    this.x = x;
    this.y = y;
  }

  getAttackStats(): AttackStats {
    return {
      damage: this.archetype.damage,
      critChance: this.archetype.critChance,
      dodgeChance: this.archetype.dodgeChance,
    };
  }
}
