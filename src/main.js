import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, MONSTER_ARCHETYPES, STARTING_CLASSES } from './data.js';
import { generateFloor, TILE, idx } from './dungeon.js';
import { computeFOV } from './fov.js';
import { createRng } from './rng.js';
import { Player, Monster } from './entities.js';

const canvas = document.getElementById('game-canvas');
canvas.width = GRID_WIDTH * TILE_SIZE;
canvas.height = GRID_HEIGHT * TILE_SIZE;
const ctx = canvas.getContext('2d');

const rng = createRng(Date.now() ^ 0x2f2f2f2f);
const floor = generateFloor(1, rng, GRID_WIDTH, GRID_HEIGHT);

const player = new Player(STARTING_CLASSES.adventurer);
const start = floor.rooms[0].center();
player.x = start.x;
player.y = start.y;

const archetypeIds = Object.keys(MONSTER_ARCHETYPES);
const monsters = floor.rooms.slice(1).map((room, i) => {
  const c = room.center();
  const archetype = MONSTER_ARCHETYPES[archetypeIds[i % archetypeIds.length]];
  return new Monster(archetype, c.x, c.y);
});

const explored = new Set();
let visible = computeFOV(floor, player.x, player.y, 8);
for (const key of visible) explored.add(key);

function isWalkable(x, y) {
  if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) return false;
  return floor.grid[idx(x, y, floor.width)] !== TILE.WALL;
}

function tryMovePlayer(dx, dy) {
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (!isWalkable(nx, ny)) return;
  player.x = nx;
  player.y = ny;
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
  for (const m of monsters) {
    const key = `${m.x},${m.y}`;
    if (!visible.has(key)) continue;
    ctx.fillStyle = m.archetype.color;
    ctx.fillRect(m.x * TILE_SIZE + 4, m.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  }
  ctx.fillStyle = '#e0d060';
  ctx.fillRect(player.x * TILE_SIZE + 4, player.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
}

function loop() {
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
