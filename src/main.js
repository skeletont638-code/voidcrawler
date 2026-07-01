import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT } from './data.js';

const canvas = document.getElementById('game-canvas');
canvas.width = GRID_WIDTH * TILE_SIZE;
canvas.height = GRID_HEIGHT * TILE_SIZE;
const ctx = canvas.getContext('2d');

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#3a3a4a';
  ctx.font = '16px monospace';
  ctx.fillText('Voidcrawler booting...', 20, 30);
}

function loop() {
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
