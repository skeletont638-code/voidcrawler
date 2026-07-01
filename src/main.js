import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, MONSTER_ARCHETYPES, STARTING_CLASSES } from './data.js';
import { generateFloor, TILE, idx } from './dungeon.js';
import { computeFOV } from './fov.js';
import { createRng } from './rng.js';
import { Player, Monster } from './entities.js';
import { resolveAttack, tickStatuses } from './combat.js';
import { decideMonsterAction } from './ai.js';

const canvas = document.getElementById('game-canvas');
canvas.width = GRID_WIDTH * TILE_SIZE;
canvas.height = GRID_HEIGHT * TILE_SIZE;
const ctx = canvas.getContext('2d');

const rng = createRng(Date.now() ^ 0x2f2f2f2f);

const player = new Player(STARTING_CLASSES.adventurer);
let floor, monsters, explored, visible;

const combatLog = [];
function log(message) {
  combatLog.push(message);
  if (combatLog.length > 6) combatLog.shift();
}

let kills = 0;
const traps = new Map(); // key "x,y" -> { damage, ownerName }

function isWalkable(x, y) {
  if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) return false;
  return floor.grid[idx(x, y, floor.width)] !== TILE.WALL;
}

function monsterAt(x, y) {
  return monsters.find(m => m.x === x && m.y === y);
}

function canSeeBetween(x1, y1, x2, y2) {
  return computeFOV(floor, x1, y1, 8).has(`${x2},${y2}`);
}

function playerAttack(target) {
  const result = resolveAttack(player.getAttackStats(), rng);
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
  }
}

function monsterTurn(monster) {
  const { totalDamage, remaining } = tickStatuses(monster.statuses);
  monster.statuses = remaining;
  monster.hp = Math.max(0, monster.hp - totalDamage);
  if (monster.hp === 0) {
    monsters = monsters.filter(m => m !== monster);
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
    }
  } else if (action.type === 'move') {
    if (isWalkable(action.to.x, action.to.y) && !monsterAt(action.to.x, action.to.y)
        && !(action.to.x === player.x && action.to.y === player.y)) {
      monster.x = action.to.x;
      monster.y = action.to.y;
    }
  } else if (action.type === 'placeTrap') {
    const trapKey = `${action.at.x},${action.at.y}`;
    if (isWalkable(action.at.x, action.at.y) && !monsterAt(action.at.x, action.at.y) && !traps.has(trapKey)) {
      traps.set(trapKey, { damage: monster.archetype.trapDamage, ownerName: monster.archetype.name });
    }
  }
}

function triggerTrapUnderPlayer() {
  const trapKey = `${player.x},${player.y}`;
  const trap = traps.get(trapKey);
  if (!trap) return;
  traps.delete(trapKey);
  player.hp = Math.max(0, player.hp - trap.damage);
  log(`You trigger a trap set by the ${trap.ownerName}! You take ${trap.damage} damage.`);
}

function tickPlayerStatuses() {
  const { totalDamage, remaining } = tickStatuses(player.statuses);
  player.statuses = remaining;
  if (totalDamage > 0) {
    player.hp = Math.max(0, player.hp - totalDamage);
    log(`You take ${totalDamage} damage from lingering status effects.`);
  }
}

function takeTurn(playerAction) {
  tickPlayerStatuses();
  playerAction();
  triggerTrapUnderPlayer();
  visible = computeFOV(floor, player.x, player.y, 8);
  for (const key of visible) explored.add(key);
  for (const monster of [...monsters]) {
    monsterTurn(monster);
  }
}

function tryMovePlayer(dx, dy) {
  const nx = player.x + dx;
  const ny = player.y + dy;
  const occupant = monsterAt(nx, ny);
  if (occupant) {
    takeTurn(() => playerAttack(occupant));
    return;
  }
  if (!isWalkable(nx, ny)) return;
  takeTurn(() => { player.x = nx; player.y = ny; });
}

function startFloor(depth) {
  floor = generateFloor(depth, rng, GRID_WIDTH, GRID_HEIGHT);
  const spawnRoom = floor.rooms[0];
  const spawn = spawnRoom.center();
  player.x = spawn.x;
  player.y = spawn.y;

  traps.clear();

  const archetypeIds = ['rusher', 'caster', 'trapper'];
  monsters = floor.rooms.slice(1).map((room, i) => {
    const c = room.center();
    return new Monster(MONSTER_ARCHETYPES[archetypeIds[i % archetypeIds.length]], c.x, c.y);
  });

  explored = new Set();
  visible = computeFOV(floor, player.x, player.y, 8);
  for (const key of visible) explored.add(key);
}

const KEY_MOVES = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
};

window.addEventListener('keydown', (e) => {
  const move = KEY_MOVES[e.key];
  if (move) {
    e.preventDefault();
    tryMovePlayer(move[0], move[1]);
  }
});

const TILE_COLORS = {
  [TILE.WALL]: '#1c1c26',
  [TILE.FLOOR]: '#2e2e3a',
  [TILE.STAIRS_DOWN]: '#4a4a2e',
};

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const key = `${x},${y}`;
      if (!explored.has(key)) continue;
      const tile = floor.grid[y * floor.width + x];
      ctx.fillStyle = TILE_COLORS[tile];
      ctx.globalAlpha = visible.has(key) ? 1.0 : 0.4;
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1);
    }
  }
  ctx.globalAlpha = 1.0;
  for (const [trapKey, trap] of traps) {
    if (!visible.has(trapKey)) continue;
    const [tx, ty] = trapKey.split(',').map(Number);
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
    ctx.fillStyle = m.archetype.color;
    ctx.fillRect(m.x * TILE_SIZE + 4, m.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  }
  ctx.fillStyle = '#e0d060';
  ctx.fillRect(player.x * TILE_SIZE + 4, player.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);

  const hud = document.getElementById('hud');
  hud.textContent = `HP ${player.hp}/${player.maxHp}  Lv ${player.level}  Floor ${floor.depth}`;
  document.getElementById('combat-log').textContent = combatLog.join('\n');
}

function loop() {
  render();
  requestAnimationFrame(loop);
}

startFloor(1);
requestAnimationFrame(loop);
