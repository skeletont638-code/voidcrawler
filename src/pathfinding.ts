import { TILE, idx } from './dungeon.js';
import type { TileGrid } from './types.js';

interface Point {
  x: number;
  y: number;
}

function heuristic(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function aStar(start: Point, goal: Point, floor: TileGrid): Point[] | null {
  const key = (p: Point) => `${p.x},${p.y}`;
  const open = new Map<string, Point>([[key(start), start]]);
  const cameFrom = new Map<string, Point>();
  const gScore = new Map<string, number>([[key(start), 0]]);
  const fScore = new Map<string, number>([[key(start), heuristic(start, goal)]]);

  while (open.size > 0) {
    let currentKey: string | null = null;
    let current: Point | null = null;
    let best = Infinity;
    for (const [k, node] of open) {
      const f = fScore.get(k) ?? Infinity;
      if (f < best) {
        best = f;
        currentKey = k;
        current = node;
      }
    }
    if (!current || !currentKey) break;

    if (current.x === goal.x && current.y === goal.y) {
      const path: Point[] = [current];
      let k: string = currentKey;
      while (cameFrom.has(k)) {
        const prev = cameFrom.get(k)!;
        path.unshift(prev);
        k = key(prev);
      }
      return path;
    }

    open.delete(currentKey);
    const neighbors: Point[] = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];
    for (const n of neighbors) {
      if (n.x < 0 || n.y < 0 || n.x >= floor.width || n.y >= floor.height) continue;
      if (floor.grid[idx(n.x, n.y, floor.width)] === TILE.WALL) continue;
      const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1;
      const nKey = key(n);
      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentativeG);
        fScore.set(nKey, tentativeG + heuristic(n, goal));
        open.set(nKey, n);
      }
    }
  }
  return null;
}
