import { TILE, idx } from './dungeon.js';
import type { TileGrid } from './types.js';

const OCTANTS: Array<[number, number, number, number]> = [
  [1, 0, 0, 1],
  [0, 1, 1, 0],
  [0, -1, 1, 0],
  [-1, 0, 0, 1],
  [-1, 0, 0, -1],
  [0, -1, -1, 0],
  [0, 1, -1, 0],
  [1, 0, 0, -1],
];

function castLight(
  floor: TileGrid,
  cx: number,
  cy: number,
  radius: number,
  visible: Set<string>,
  row: number,
  start: number,
  end: number,
  xx: number,
  xy: number,
  yx: number,
  yy: number,
): void {
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
          if (isWall) {
            newStart = rSlope;
            continue;
          }
          blocked = false;
          start = newStart;
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

export function computeFOV(floor: TileGrid, originX: number, originY: number, radius: number): Set<string> {
  const visible = new Set<string>([`${originX},${originY}`]);
  for (const [xx, xy, yx, yy] of OCTANTS) {
    castLight(floor, originX, originY, radius, visible, 1, 1.0, 0.0, xx, xy, yx, yy);
  }
  return visible;
}
