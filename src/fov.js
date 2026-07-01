import { TILE, idx } from './dungeon.js';

const OCTANTS = [
  [1, 0, 0, 1], [0, 1, 1, 0], [0, -1, 1, 0], [-1, 0, 0, 1],
  [-1, 0, 0, -1], [0, -1, -1, 0], [0, 1, -1, 0], [1, 0, 0, -1],
];

function castLight(floor, cx, cy, radius, visible, row, start, end, xx, xy, yx, yy) {
  if (start < end) return;
  let newStart = 0;
  for (let i = row; i <= radius; i++) {
    let dx = -i - 1;
    const dy = -i;
    let blocked = false;
    while (dx <= 0) {
      dx += 1;
      const mapX = cx + dx * xx + dy * xy;
      const mapY = cy + dx * yx + dy * yy;
      const lSlope = (dx - 0.5) / (dy + 0.5);
      const rSlope = (dx + 0.5) / (dy - 0.5);
      if (start < rSlope) continue;
      if (end > lSlope) break;
      if (mapX >= 0 && mapX < floor.width && mapY >= 0 && mapY < floor.height) {
        if (dx * dx + dy * dy <= radius * radius) {
          visible.add(`${mapX},${mapY}`);
        }
        const isWall = floor.grid[idx(mapX, mapY, floor.width)] === TILE.WALL;
        if (blocked) {
          if (isWall) { newStart = rSlope; continue; }
          blocked = false; start = newStart;
        } else if (isWall && i < radius) {
          blocked = true;
          castLight(floor, cx, cy, radius, visible, i + 1, start, lSlope, xx, xy, yx, yy);
          newStart = rSlope;
        }
      }
    }
    if (blocked) break;
  }
}

export function computeFOV(floor, originX, originY, radius) {
  const visible = new Set([`${originX},${originY}`]);
  for (const [xx, xy, yx, yy] of OCTANTS) {
    castLight(floor, originX, originY, radius, visible, 1, 1.0, 0.0, xx, xy, yx, yy);
  }
  return visible;
}
