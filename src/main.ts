import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, MONSTER_ARCHETYPES, STARTING_CLASSES, BIOMES } from './data.js';
import { generateFloor, TILE, idx } from './dungeon.js';
import { computeFOV } from './fov.js';
import { createRng } from './rng.js';
import { Player, Monster } from './entities.js';
import { resolveAttack, tickStatuses } from './combat.js';
import { decideMonsterAction } from './ai.js';
import { generateItem, rollLootTable, RARITY } from './items.js';
import { BASE_ITEMS, ACCESSORY_BASE_ITEMS, getLootTableForFloor } from './data.js';
import { renderHUD, renderInventory, renderCombatLog, renderMinimap } from './ui.js';
import {
  createShake, updateShake, getShakeOffset,
  createParticleBurst, updateParticles,
  createFloatingText, updateFloatingTexts,
  createTween, updateTween, getTweenPosition, drawFx,
} from './fx.js';
import { loadMeta, saveMeta, applyRunResult, purchaseClass } from './save.js';
import { drawSprite } from './sprites.js';
import { playSound, setMuted, isMuted } from './audio.js';
import type { Floor, Item, FxState, TweenState, Biome, Perk } from './types.js';

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

let meta = loadMeta();
setMuted(meta.mutedAudio);
let gameState: 'playing' | 'dead' | 'victory' = 'playing';
let screen: 'title' | 'playing' | 'dead' | 'victory' = 'title';
let selectedClassIndex = 0;
const classIds = Object.keys(STARTING_CLASSES);
let lastRunSummary: { state: 'dead' | 'victory'; floor: number; biome: string; kills: number; earned: number; totalCurrency: number } | null = null;

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

let pendingPerkChoice: Perk[] | null = null;

function chebyshevDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

function biomeForDepth(depth: number): Biome {
  return BIOMES.find(b => b.floors.includes(depth)) ?? BIOMES[BIOMES.length - 1]!;
}

function weightedArchetypePick(weights: Record<string, number>): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [id, weight] of entries) {
    if (roll < weight) return id;
    roll -= weight;
  }
  return entries[entries.length - 1]![0]!;
}

function grantXp(amount: number): void {
  const scaled = Math.round(amount * player.getXpMultiplier());
  const { perkChoices } = player.gainXp(scaled);
  if (perkChoices.length > 0) {
    pendingPerkChoice = perkChoices;
    playSound('levelUp');
    log(`Level up! Choose a perk: 1) ${perkChoices[0]!.label}  2) ${perkChoices[1]!.label}  3) ${perkChoices[2]!.label}`);
  }
}

function choosePerk(index: number): void {
  if (!pendingPerkChoice) return;
  const perk = pendingPerkChoice[index];
  if (!perk) return;
  perk.apply(player);
  log(`You gain a perk: ${perk.label}.`);
  pendingPerkChoice = null;
}

function maybeDropLoot(x: number, y: number): void {
  const lootTable = getLootTableForFloor(floor.depth);
  const entry = rollLootTable(lootTable, rng);
  if (!entry.itemId) return;
  const base = [...BASE_ITEMS, ...ACCESSORY_BASE_ITEMS].find(b => b.id === entry.itemId)!;
  const rarity = RARITY[Math.min(RARITY.length - 1, Math.floor(rng() * rng() * RARITY.length))]!;
  groundItems.set(`${x},${y}`, generateItem(base, rarity, rng, floor.depth));
}

function pickUpItemUnderPlayer(): void {
  const key = `${player.x},${player.y}`;
  const item = groundItems.get(key);
  if (!item) return;
  groundItems.delete(key);
  player.inventory.push(item);
  playSound('pickup');
  log(`You pick up ${item.name} (${item.rarity}).`);
}

function equipOrUseItem(index: number): void {
  const item = player.inventory[index];
  if (!item) return;
  if (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory') {
    const slot: 'weapon' | 'armor' | 'accessory' = item.type;
    player.equipment[slot] = item;
    player.inventory.splice(index, 1);
    log(`You equip ${item.name}.`);
  } else if (item.type === 'potion') {
    item.identified = true;
    player.hp = Math.min(player.maxHp + player.getMaxHpBonus(), player.hp + (item.healAmount ?? 0));
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

function isWalkableForSpawn(f: Floor, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= f.width || y >= f.height) return false;
  return f.grid[idx(x, y, f.width)] !== TILE.WALL;
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
  if (result.crit) { fxState.shake = createShake(4, 0.15); playSound('crit'); }
  else if (result.hit) { playSound('hit'); }
  else { playSound('miss'); }
  if (!result.hit) {
    log(`You miss the ${target.archetype.name}.`);
    return;
  }
  target.hp = Math.max(0, target.hp - result.damage);
  log(`You hit the ${target.archetype.name} for ${result.damage}${result.crit ? ' (crit!)' : ''}.`);
  if (result.crit && player.perks.includes('lifesteal')) {
    const healed = Math.round(result.damage * 0.2);
    player.hp = Math.min(player.maxHp + player.getMaxHpBonus(), player.hp + healed);
    log(`You steal ${healed} HP from the ${target.archetype.name}.`);
  }
  if (target.hp === 0) {
    log(`The ${target.archetype.name} dies.`);
    playSound('death');
    monsters = monsters.filter(m => m !== target);
    kills += 1;
    grantXp(10);
    maybeDropLoot(target.x, target.y);
    fxState.particles.push(...createParticleBurst(target.x * TILE_SIZE + TILE_SIZE / 2, target.y * TILE_SIZE + TILE_SIZE / 2, 12, rng));
    if (target.archetype.id === biomeForDepth(floor.depth).bossArchetypeId && floor.depth === 9) {
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
    playSound('death');
    monsters = monsters.filter(m => m !== monster);
    kills += 1;
    grantXp(10);
    maybeDropLoot(monster.x, monster.y);
    return;
  }

  const action = decideMonsterAction(monster, player, floor, canSeeBetween, monsters.filter(m => m !== monster));
  if (action.type === 'attack' || action.type === 'rangedAttack') {
    const result = resolveAttack(monster.getAttackStats(), rng);
    if (!result.hit) {
      log(`The ${monster.archetype.name} misses you.`);
    } else {
      player.hp = Math.max(0, player.hp - result.damage);
      log(`The ${monster.archetype.name} hits you for ${result.damage}${result.crit ? ' (crit!)' : ''}.`);
      fxState.floatingTexts.push(createFloatingText(player.x * TILE_SIZE, player.y * TILE_SIZE, String(result.damage), '#ff6666'));
      fxState.shake = createShake(3, 0.15);
      playSound(result.crit ? 'crit' : 'hit');
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
  } else if (action.type === 'heal') {
    const target = action.healTarget!;
    const healAmount = Math.round(target.maxHp * 0.25);
    target.hp = Math.min(target.maxHp, target.hp + healAmount);
    log(`The ${monster.archetype.name} heals the ${target.archetype.name} for ${healAmount}.`);
    fxState.floatingTexts.push(createFloatingText(target.x * TILE_SIZE, target.y * TILE_SIZE, `+${healAmount}`, '#6adf6a'));
  }
}

function endRun(state: 'dead' | 'victory'): void {
  gameState = state;
  screen = state;
  const { updated, earned } = applyRunResult(meta, { floorReached: floor.depth, kills });
  meta = updated;
  saveMeta(meta);
  lastRunSummary = {
    state, floor: floor.depth, biome: biomeForDepth(floor.depth).name,
    kills, earned, totalCurrency: meta.currency,
  };
  log(state === 'dead'
    ? `You died on floor ${floor.depth}. Earned ${earned} currency (total ${meta.currency}).`
    : `You escaped the depths! Earned ${earned} currency (total ${meta.currency}).`);
}

function triggerTrapUnderPlayer(): void {
  const trapKey = `${player.x},${player.y}`;
  const trap = traps.get(trapKey);
  if (!trap) return;
  traps.delete(trapKey);
  const trapDamage = Math.max(0, trap.damage - (player.perks.includes('resilience') ? 2 : 0));
  player.hp = Math.max(0, player.hp - trapDamage);
  playSound('trap');
  log(`You trigger a trap set by the ${trap.ownerName}! You take ${trapDamage} damage.`);
}

function tickPlayerStatuses(): void {
  const { totalDamage, remaining } = tickStatuses(player.statuses);
  player.statuses = remaining;
  if (totalDamage > 0) {
    const reduced = Math.max(0, totalDamage - (player.perks.includes('resilience') ? 2 : 0));
    player.hp = Math.max(0, player.hp - reduced);
    log(`You take ${reduced} damage from lingering status effects.`);
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
    playSound('stairs');
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

  const biome = biomeForDepth(depth);
  const isBossFloor = depth === biome.floors[2];

  if (isBossFloor) {
    const bossRoom = floor.rooms[floor.rooms.length - 1]!;
    const c = bossRoom.center();
    monsters = [new Monster(MONSTER_ARCHETYPES[biome.bossArchetypeId]!, c.x, c.y)];
  } else {
    monsters = [];
    for (const room of floor.rooms.slice(1)) {
      const c = room.center();
      const archetypeId = weightedArchetypePick(biome.archetypeWeights);
      const archetype = MONSTER_ARCHETYPES[archetypeId]!;
      if (archetype.packSize) {
        for (let i = 0; i < archetype.packSize; i++) {
          const offsetX = c.x + (i % 2 === 0 ? Math.floor(i / 2) : -Math.floor((i + 1) / 2));
          const offsetY = c.y;
          const spawnX = isWalkableForSpawn(floor, offsetX, offsetY) ? offsetX : c.x;
          const spawnY = isWalkableForSpawn(floor, offsetX, offsetY) ? offsetY : c.y;
          monsters.push(new Monster(archetype, spawnX, spawnY));
        }
      } else {
        monsters.push(new Monster(archetype, c.x, c.y));
      }
    }
  }

  explored = new Set();
  visible = computeFOV(floor, player.x, player.y, 8);
  for (const key of visible) explored.add(key);
}

function renderTitleScreen(): void {
  const panel = document.getElementById('title-screen')!;
  panel.classList.toggle('hidden', screen !== 'title');
  if (screen !== 'title') return;
  document.getElementById('title-currency')!.textContent = `Currency: ${meta.currency}`;
  const list = document.getElementById('class-list')!;
  list.innerHTML = classIds.map((id, i) => {
    const cls = STARTING_CLASSES[id]!;
    const unlocked = meta.unlockedClasses.includes(id);
    const marker = i === selectedClassIndex ? '&gt; ' : '&nbsp;&nbsp;';
    const status = unlocked ? '' : ` (locked — ${cls.unlockCost} currency)`;
    return `<div>${marker}${cls.name} (HP ${cls.baseHp}, STR ${cls.str}, DEX ${cls.dex}, VIT ${cls.vit})${status}</div>`;
  }).join('');
}

function renderPerkChoice(): void {
  const panel = document.getElementById('perk-choice')!;
  panel.classList.toggle('hidden', !pendingPerkChoice);
  if (!pendingPerkChoice) return;
  const optionsEl = document.getElementById('perk-options')!;
  optionsEl.innerHTML = pendingPerkChoice.map((perk, i) => `<div>${i + 1}) ${perk.label}</div>`).join('');
}

function renderRunSummary(): void {
  const panel = document.getElementById('run-summary')!;
  panel.classList.toggle('hidden', !lastRunSummary);
  if (!lastRunSummary) return;
  const s = lastRunSummary;
  document.getElementById('run-summary-title')!.textContent = s.state === 'dead' ? 'You Died' : 'You Escaped!';
  document.getElementById('run-summary-stats')!.innerHTML = [
    `Reached floor ${s.floor} (${s.biome})`,
    `Kills: ${s.kills}`,
    `Currency earned: ${s.earned} (total: ${s.totalCurrency})`,
  ].join('<br>');
}

function startRun(classId: string): void {
  const chosenClass = STARTING_CLASSES[classId]!;
  Object.assign(player, new Player(chosenClass));
  screen = 'playing';
  gameState = 'playing';
  startFloor(1);
}

let inventoryOpen = false;

const KEY_MOVES: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
};

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (screen === 'title') {
    if (e.key === 'ArrowUp') { selectedClassIndex = (selectedClassIndex - 1 + classIds.length) % classIds.length; return; }
    if (e.key === 'ArrowDown') { selectedClassIndex = (selectedClassIndex + 1) % classIds.length; return; }
    if (e.key === 'b') {
      const classId = classIds[selectedClassIndex]!;
      const result = purchaseClass(meta, classId);
      if (result.success) {
        meta = result.updated;
        saveMeta(meta);
        log(`Unlocked ${STARTING_CLASSES[classId]!.name}!`);
      } else {
        log(`Can't unlock: ${result.reason}.`);
      }
      return;
    }
    if (e.key === 'm') {
      const next = !isMuted();
      setMuted(next);
      meta = { ...meta, mutedAudio: next };
      saveMeta(meta);
      return;
    }
    if (e.key === 'Enter') {
      const classId = classIds[selectedClassIndex]!;
      if (meta.unlockedClasses.includes(classId)) {
        startRun(classId);
      }
      return;
    }
    return;
  }
  if (gameState !== 'playing') {
    if (e.key === 'Enter') location.reload();
    return;
  }
  if (pendingPerkChoice) {
    if (/^[1-3]$/.test(e.key)) {
      choosePerk(Number(e.key) - 1);
    }
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
  if (e.key === 'm') {
    const next = !isMuted();
    setMuted(next);
    meta = { ...meta, mutedAudio: next };
    saveMeta(meta);
    log(next ? 'Sound muted.' : 'Sound unmuted.');
    return;
  }
  if (/^[1-9]$/.test(e.key)) {
    equipOrUseItem(Number(e.key) - 1);
  }
});

const ITEM_RARITY_COLORS: Record<string, string> = { common: '#c8c8c8', uncommon: '#5ad45a', rare: '#4a90ff', legendary: '#e0a030' };

function render(): void {
  document.getElementById('title-screen')!.classList.add('hidden');
  const shakeOffset = getShakeOffset(fxState.shake);
  ctx.save();
  ctx.translate(shakeOffset.x, shakeOffset.y);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const biome = biomeForDepth(floor.depth);
  const tileColors: Record<number, string> = {
    [TILE.WALL]: biome.wallColor,
    [TILE.FLOOR]: biome.floorColor,
    [TILE.STAIRS_DOWN]: biome.stairsColor,
  };
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const key = `${x},${y}`;
      if (!explored.has(key)) continue;
      const tile = floor.grid[y * floor.width + x]!;
      ctx.fillStyle = tileColors[tile]!;
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
    if (m.archetype.invisible && chebyshevDistance(m.x, m.y, player.x, player.y) > 1) continue;
    const tween = monsterTweens.get(m) ?? null;
    const pixelPos = tween ? getTweenPosition(tween)! : { x: m.x, y: m.y };
    drawSprite(ctx, m.archetype.id, pixelPos.x * TILE_SIZE + 4, pixelPos.y * TILE_SIZE + 4, TILE_SIZE - 8, m.archetype.color);
  }
  const playerPixelPos = playerTween ? getTweenPosition(playerTween)! : { x: player.x, y: player.y };
  drawSprite(ctx, 'player', playerPixelPos.x * TILE_SIZE + 4, playerPixelPos.y * TILE_SIZE + 4, TILE_SIZE - 8, '#e0d060');
  drawFx(ctx, fxState);
  ctx.restore();

  renderHUD(player, floor);
  renderInventory(player, inventoryOpen);
  renderCombatLog(combatLog);
  renderMinimap(ctx, floor, player, explored);
  renderPerkChoice();
  renderRunSummary();
}

function loop(): void {
  if (screen === 'title') {
    renderTitleScreen();
    requestAnimationFrame(loop);
    return;
  }
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

requestAnimationFrame(loop);
