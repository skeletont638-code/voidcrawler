import { XP_TABLE } from './data.js';

export function xpForNextLevel(level) {
  if (level < XP_TABLE.length) return XP_TABLE[level];
  return XP_TABLE[XP_TABLE.length - 1] + (level - XP_TABLE.length + 1) * 100;
}

export class Player {
  constructor(startingClass) {
    this.maxHp = startingClass.baseHp;
    this.hp = this.maxHp;
    this.level = 1;
    this.xp = 0;
    this.statPoints = 0;
    this.str = startingClass.str;
    this.dex = startingClass.dex;
    this.vit = startingClass.vit;
    this.inventory = [];
    this.equipment = { weapon: null, armor: null };
    this.x = 0;
    this.y = 0;
    this.statuses = [];
  }

  gainXp(amount) {
    this.xp += amount;
    let leveled = false;
    while (this.xp >= xpForNextLevel(this.level)) {
      this.xp -= xpForNextLevel(this.level);
      this.level += 1;
      this.statPoints += 1;
      this.maxHp += 5;
      this.hp = this.maxHp;
      leveled = true;
    }
    return leveled;
  }

  getAttackStats() {
    const weaponDamage = this.equipment.weapon?.affixes?.reduce(
      (sum, a) => sum + (a.key === 'damage' ? a.value : 0), this.equipment.weapon.baseDamage ?? 3,
    ) ?? (2 + this.str);
    const critChance = 0.05 + this.dex * 0.01 + (this.equipment.weapon?.affixes ?? [])
      .reduce((sum, a) => sum + (a.key === 'critChance' ? a.value : 0), 0);
    const dodgeChance = 0.03 + this.dex * 0.005 + (this.equipment.armor?.affixes ?? [])
      .reduce((sum, a) => sum + (a.key === 'resistance' ? a.value * 0.2 : 0), 0);
    return { damage: weaponDamage, critChance, dodgeChance };
  }
}

export class Monster {
  constructor(archetype, x, y) {
    this.archetype = archetype;
    this.hp = archetype.hp;
    this.maxHp = archetype.hp;
    this.x = x;
    this.y = y;
    this.state = 'idle';
    this.statuses = [];
    this.lastKnownPlayerPos = null;
  }

  getAttackStats() {
    return {
      damage: this.archetype.damage,
      critChance: this.archetype.critChance,
      dodgeChance: this.archetype.dodgeChance,
    };
  }
}
