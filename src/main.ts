import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, MONSTER_ARCHETYPES, STARTING_CLASSES } from './data.js';
import { generateFloor, TILE, idx } from './dungeon.js';
import { computeFOV } from './fov.js';
import { createRng } from './rng.js';
import { Player, Monster } from './entities.js';
import { resolveAttack, tickStatuses } from './combat.js';
import { decideMonsterAction } from './ai.js';
import { generateItem, rollLootTable, RARITY } from './items.js';
import { BASE_ITEMS, getLootTableForFloor } from './data.js';
import { renderHUD, renderInventory, renderCombatLog, renderMinimap } from './ui.js';
import {
  createShake, updateShake, getShakeOffset,
  createParticleBurst, updateParticles,
  createFloatingText, updateFloatingTexts,
  createTween, updateTween, getTweenPosition, drawFx,
} from './fx.js';
import { loadMeta, saveMeta, applyRunResult } from './save.js';
import type { Floor, Item, FxState, TweenState } from './types.js';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
canvas.width = GRID_WIDTH * TILE_SIZE;
canvas.height = GRID_HEIGHT * TILE_SIZE;
const ctx = canvas.getContext('2d')!;

const rng = createRng(Date.now() ^ 0x2f2f2f2f);

const player = new Player(STARTING_CLASSES.adventurer!);
let floor: Floor;
let monsters: Monster[];
let explored: Set<string>;
let visible: Set<string>;

const meta = loadMeta();
let gameState: 'playing' | 'dead' | 'victory' = 'playing';

const combatLog: string[] = [];
function log(message: string): void {
  combatLog.push(message);
  if (combatLog.length > 6) combatLog.shift();
}

let kills = 0;
const traps = new Map<string, { damage: number; ownerName: string }>();
const groundItems = new Map<string, Item>();

const fxState: FxState = { shake: null, particles: [], floatingTexts: [] };
let lastFrameTime = performance.now();
let playerTween: TweenState | null = null;
const monsterTweens = new WeakMap<Monster, TweenState>();

function maybeDropLoot(x: number, y: number): void {
  const lootTable = getLootTableForFloor(floor.depth);
  const entry = rollLootTable(lootTable, rng);
  if (!entry.itemId) return;
  const base = BASE_ITEMS.find(b => b.id === entry.itemId)!;
  const rarity = RARITY[Math.min(RARITY.length - 1, Math.floor(rng() * rng() * RARITY.length))]!;
  groundItems.set(`${x},${y}`, generateItem(base, rarity, rng, floor.depth));
}

function pickUpItemUnderPlayer(): void {
  const key = `${player.x},${player.y}`;
  const item = groundItems.get(key);
  if (!item) return;
  groundItems.delete(key);
  player.inventory.push(item);
  log(`You pick up ${item.name} (${item.rarity}).`);
}

function equipOrUseItem(index: number): void {
  const item = player.inventory[index];
  if (!item) return;
  if (item.type === 'weapon' || item.type === 'armor') {
    const slot: 'weapon' | 'armor' = item.type === 'weapon' ? 'weapon' : 'armor';
    player.equipment[slot] = item;
    player.inventory.splice(index, 1);
    log(`You equip ${item.name}.`);
  } else if (item.type === 'potion') {
    item.identified = true;
    player.hp = Math.min(player.maxHp, player.hp + (item.healAmount ?? 0));
    player.inventory.splice(index, 1);
    log(`You drink the potion and recover ${item.healAmount ?? 0} HP.`);
  } else if (item.type === 'scroll') {
    item.identified = true;
    player.inventory.splice(index, 1);
    const target = monsters.find(m => visible.has(`${m.x},${m.y}`));
    if (target) {
      target.statuses.push({ damagePerTick: 3, turnsRemaining: 3 });
      log(`You read the scroll — the nearest visible ${target.archetype.name} catches fire!`);
    } else {
      log('You read the scroll, but no target is in sight. It fizzles.');
    }
  }
}

function isWalkable(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) return false;
  return floor.grid[idx(x, y, floor.width)] !== TILE.WALL;
}

function monsterAt(x: number, y: number): Monster | undefined {
  return monsters.find(m => m.x === x && m.y === y);
}

function canSeeBetween(x1: number, y1: number, x2: number, y2: number): boolean {
  return computeFOV(floor, x1, y1, 8).has(`${x2},${y2}`);
}

function playerAttack(target: Monster): void {
  const result = resolveAttack(player.getAttackStats(), rng);
  fxState.floatingTexts.push(createFloatingText(
    target.x * TILE_SIZE, target.y * TILE_SIZE, result.hit ? String(result.damage) : 'miss',
    result.crit ? '#ffcc33' : '#ffffff',
  ));
  if (result.crit) fxState.shake = createShake(4, 0.15);
  if (!result.hit) {
    log(`You miss the ${target.archetype.name}.`);
    return;
  }
  target.hp = Math.max(0, target.hp - result.damage);
  log(`You hit the ${target.archetype.name} for ${result.damage}${result.crit ? ' (crit!)' : ''}.`);
  if (target.hp === 0) {
    log(`The ${target.archetype.name} dies.`);
    monsters = monsters.filter(m => m !== target);
    kills += 1;
    player.gainXp(10);
    maybeDropLoot(target.x, target.y);
    fxState.particles.push(...createParticleBurst(target.x * TILE_SIZE + TILE_SIZE / 2, target.y * TILE_SIZE + TILE_SIZE / 2, 12, rng));
    if (target.archetype.id === 'boss') {
      endRun('victory');
    }
  }
}

function monsterTurn(monster: Monster): void {
  const { totalDamage, remaining } = tickStatuses(monster.statuses);
  monster.statuses = remaining;
  monster.hp = Math.max(0, monster.hp - totalDamage);
  if (monster.hp === 0) {
    log(`The ${monster.archetype.name} burns to death.`);
    monsters = monsters.filter(m => m !== monster);
    kills += 1;
    player.gainXp(10);
    maybeDropLoot(monster.x, monster.y);
    return;
  }

  const action = decideMonsterAction(monster, player, floor, canSeeBetween);
  if (action.type === 'attack' || action.type === 'rangedAttack') {
    const result = resolveAttack(monster.getAttackStats(), rng);
    if (!result.hit) {
      log(`The ${monster.archetype.name} misses you.`);
    } else {
      player.hp = Math.max(0, player.hp - result.damage);
      log(`The ${monster.archetype.name} hits you for ${result.damage}${result.crit ? ' (crit!)' : ''}.`);
      fxState.floatingTexts.push(createFloatingText(player.x * TILE_SIZE, player.y * TILE_SIZE, String(result.damage), '#ff6666'));
      fxState.shake = createShake(3, 0.15);
    }
  } else if (action.type === 'move') {
    const to = action.to!;
    if (isWalkable(to.x, to.y) && !monsterAt(to.x, to.y)
        && !(to.x === player.x && to.y === player.y)) {
      const moveFrom = { x: monster.x, y: monster.y };
      monster.x = to.x;
      monster.y = to.y;
      monsterTweens.set(monster, createTween(moveFrom, { x: monster.x, y: monster.y }, 0.12));
    }
  } else if (action.type === 'placeTrap') {
    const at = action.at!;
    const trapKey = `${at.x},${at.y}`;
    if (isWalkable(at.x, at.y) && !monsterAt(at.x, at.y) && !traps.has(trapKey)) {
      traps.set(trapKey, { damage: monster.archetype.trapDamage ?? 0, ownerName: monster.archetype.name });
    }
  }
}

function endRun(state: 'dead' | 'victory'): void {
  gameState = state;
  const { updated, earned } = applyRunResult(meta, { floorReached: floor.depth, kills });
  saveMeta(updated);
  log(state === 'dead'
    ? `You died on floor ${floor.depth}. Earned ${earned} currency (total ${updated.currency}).`
    : `You escaped the depths! Earned ${earned} currency (total ${updated.currency}).`);
}

function triggerTrapUnderPlayer(): void {
  const trapKey = `${player.x},${player.y}`;
  const trap = traps.get(trapKey);
  if (!trap) return;
  traps.delete(trapKey);
  player.hp = Math.max(0, player.hp - trap.damage);
  log(`You trigger a trap set by the ${trap.ownerName}! You take ${trap.damage} damage.`);
}

function tickPlayerStatuses(): void {
  const { totalDamage, remaining } = tickStatuses(player.statuses);
  player.statuses = remaining;
  if (totalDamage > 0) {
    player.hp = Math.max(0, player.hp - totalDamage);
    log(`You take ${totalDamage} damage from lingering status effects.`);
  }
}

function checkPlayerDeath(): boolean {
  if (player.hp === 0 && gameState === 'playing') {
    endRun('dead');
    return true;
  }
  return false;
}

function takeTurn(playerAction: () => void): void {
  tickPlayerStatuses();
  if (checkPlayerDeath()) return;
  playerAction();
  triggerTrapUnderPlayer();
  if (checkPlayerDeath()) return;
  visible = computeFOV(floor, player.x, player.y, 8);
  for (const key of visible) explored.add(key);
  for (const monster of [...monsters]) {
    monsterTurn(monster);
    if (checkPlayerDeath()) return;
  }
}

function tryMovePlayer(dx: number, dy: number): void {
  const nx = player.x + dx;
  const ny = player.y + dy;
  const occupant = monsterAt(nx, ny);
  if (occupant) {
    takeTurn(() => playerAttack(occupant));
    return;
  }
  if (!isWalkable(nx, ny)) return;
  const moveFrom = { x: player.x, y: player.y };
  takeTurn(() => { player.x = nx; player.y = ny; });
  playerTween = createTween(moveFrom, { x: player.x, y: player.y }, 0.12);

  const tile = floor.grid[idx(player.x, player.y, floor.width)];
  if (tile === TILE.STAIRS_DOWN && gameState === 'playing' && floor.depth < 9) {
    log(`You descend to floor ${floor.depth + 1}.`);
    startFloor(floor.depth + 1);
  }
}

function startFloor(depth: number): void {
  floor = generateFloor(depth, rng, GRID_WIDTH, GRID_HEIGHT);
  const spawnRoom = floor.rooms[0]!;
  const spawn = spawnRoom.center();
  player.x = spawn.x;
  player.y = spawn.y;

  traps.clear();
  groundItems.clear();
  playerTween = null;

  if (depth === 9) {
    const bossRoom = floor.rooms[floor.rooms.length - 1]!;
    const c = bossRoom.center();
    monsters = [new Monster(MONSTER_ARCHETYPES.boss!, c.x, c.y)];
  } else {
    const archetypeIds = ['rusher', 'caster', 'trapper'];
    monsters = floor.rooms.slice(1).map((room, i) => {
      const c = room.center();
      return new Monster(MONSTER_ARCHETYPES[archetypeIds[i % archetypeIds.length]!]!, c.x, c.y);
    });
  }

  explored = new Set();
  visible = computeFOV(floor, player.x, player.y, 8);
  for (const key of visible) explored.add(key);
}

let inventoryOpen = false;

const KEY_MOVES: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
};

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (gameState !== 'playing') {
    if (e.key === 'Enter') location.reload();
    return;
  }
  const move = KEY_MOVES[e.key];
  if (move) {
    e.preventDefault();
    tryMovePlayer(move[0], move[1]);
    return;
  }
  if (e.key === 'g') {
    pickUpItemUnderPlayer();
    return;
  }
  if (e.key === 'i') {
    inventoryOpen = !inventoryOpen;
    return;
  }
  if (e.key === 'p' && player.statPoints > 0) {
    player.str += 1;
    player.statPoints -= 1;
    return;
  }
  if (/^[1-9]$/.test(e.key)) {
    equipOrUseItem(Number(e.key) - 1);
  }
});

const TILE_COLORS: Record<number, string> = {
  [TILE.WALL]: '#1c1c26',
  [TILE.FLOOR]: '#2e2e3a',
  [TILE.STAIRS_DOWN]: '#4a4a2e',
};

const ITEM_RARITY_COLORS: Record<string, string> = { common: '#c8c8c8', uncommon: '#5ad45a', rare: '#4a90ff', legendary: '#e0a030' };

function render(): void {
  const shakeOffset = getShakeOffset(fxState.shake);
  ctx.save();
  ctx.translate(shakeOffset.x, shakeOffset.y);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const key = `${x},${y}`;
      if (!explored.has(key)) continue;
      const tile = floor.grid[y * floor.width + x]!;
      ctx.fillStyle = TILE_COLORS[tile]!;
      ctx.globalAlpha = visible.has(key) ? 1.0 : 0.4;
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1);
    }
  }
  ctx.globalAlpha = 1.0;
  for (const [itemKey, item] of groundItems) {
    if (!explored.has(itemKey)) continue;
    const [ixStr, iyStr] = itemKey.split(',');
    const ix = Number(ixStr);
    const iy = Number(iyStr);
    ctx.globalAlpha = visible.has(itemKey) ? 1.0 : 0.4;
    ctx.fillStyle = ITEM_RARITY_COLORS[item.rarity] ?? '#c8c8c8';
    ctx.beginPath();
    ctx.arc(ix * TILE_SIZE + TILE_SIZE / 2, iy * TILE_SIZE + TILE_SIZE / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
  for (const [trapKey] of traps) {
    if (!visible.has(trapKey)) continue;
    const [txStr, tyStr] = trapKey.split(',');
    const tx = Number(txStr);
    const ty = Number(tyStr);
    ctx.strokeStyle = '#d04040';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx * TILE_SIZE + 5, ty * TILE_SIZE + 5);
    ctx.lineTo(tx * TILE_SIZE + TILE_SIZE - 5, ty * TILE_SIZE + TILE_SIZE - 5);
    ctx.moveTo(tx * TILE_SIZE + TILE_SIZE - 5, ty * TILE_SIZE + 5);
    ctx.lineTo(tx * TILE_SIZE + 5, ty * TILE_SIZE + TILE_SIZE - 5);
    ctx.stroke();
  }
  for (const m of monsters) {
    const key = `${m.x},${m.y}`;
    if (!visible.has(key)) continue;
    const tween = monsterTweens.get(m) ?? null;
    const pixelPos = tween ? getTweenPosition(tween)! : { x: m.x, y: m.y };
    ctx.fillStyle = m.archetype.color;
    ctx.fillRect(pixelPos.x * TILE_SIZE + 4, pixelPos.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  }
  const playerPixelPos = playerTween ? getTweenPosition(playerTween)! : { x: player.x, y: player.y };
  ctx.fillStyle = '#e0d060';
  ctx.fillRect(playerPixelPos.x * TILE_SIZE + 4, playerPixelPos.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  drawFx(ctx, fxState);
  ctx.restore();

  renderHUD(player, floor);
  renderInventory(player, inventoryOpen);
  renderCombatLog(combatLog);
  renderMinimap(ctx, floor, player, explored);
}

function loop(): void {
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  fxState.shake = updateShake(fxState.shake, dt);
  fxState.particles = updateParticles(fxState.particles, dt);
  fxState.floatingTexts = updateFloatingTexts(fxState.floatingTexts, dt);
  playerTween = updateTween(playerTween, dt);
  for (const m of monsters) {
    const tween = monsterTweens.get(m);
    if (!tween) continue;
    const updated = updateTween(tween, dt);
    if (updated) monsterTweens.set(m, updated);
    else monsterTweens.delete(m);
  }
  render();
  requestAnimationFrame(loop);
}

startFloor(1);
requestAnimationFrame(loop);
