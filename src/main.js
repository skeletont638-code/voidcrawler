import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT } from './data.js';
import { generateFloor, TILE } from './dungeon.js';
import { computeFOV } from './fov.js';
import { createRng } from './rng.js';

const canvas = document.getElementById('game-canvas');
canvas.width = GRID_WIDTH * TILE_SIZE;
canvas.height = GRID_HEIGHT * TILE_SIZE;
const ctx = canvas.getContext('2d');

const rng = createRng(Date.now() ^ 0x2f2f2f2f);
const floor = generateFloor(1, rng, GRID_WIDTH, GRID_HEIGHT);
const playerStart = floor.rooms[0].center();
const explored = new Set();
let visible = computeFOV(floor, playerStart.x, playerStart.y, 8);
for (const key of visible) explored.add(key);

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
  ctx.fillStyle = '#e0d060';
  ctx.fillRect(playerStart.x * TILE_SIZE + 4, playerStart.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
}

function loop() {
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
