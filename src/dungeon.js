export const TILE = { WALL: 0, FLOOR: 1, STAIRS_DOWN: 2 };

export function idx(x, y, width) {
  return y * width + x;
}

export class Room {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
  }
  center() {
    return { x: Math.floor(this.x + this.w / 2), y: Math.floor(this.y + this.h / 2) };
  }
}

function splitBSP(x, y, w, h, rng, minSize, depth) {
  if (depth <= 0 || w < minSize * 2 || h < minSize * 2) {
    return [{ x, y, w, h }];
  }
  const splitHorizontal = w > h ? false : (h > w ? true : rng() < 0.5);
  if (splitHorizontal) {
    const splitAt = Math.floor(minSize + rng() * (h - minSize * 2));
    return [
      ...splitBSP(x, y, w, splitAt, rng, minSize, depth - 1),
      ...splitBSP(x, y + splitAt, w, h - splitAt, rng, minSize, depth - 1),
    ];
  }
  const splitAt = Math.floor(minSize + rng() * (w - minSize * 2));
  return [
    ...splitBSP(x, y, splitAt, h, rng, minSize, depth - 1),
    ...splitBSP(x + splitAt, y, w - splitAt, h, rng, minSize, depth - 1),
  ];
}

function carveRoom(grid, width, room) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      grid[idx(x, y, width)] = TILE.FLOOR;
    }
  }
}

function carveCorridor(grid, width, from, to) {
  let { x, y } = from;
  while (x !== to.x) {
    grid[idx(x, y, width)] = TILE.FLOOR;
    x += x < to.x ? 1 : -1;
  }
  while (y !== to.y) {
    grid[idx(x, y, width)] = TILE.FLOOR;
    y += y < to.y ? 1 : -1;
  }
  grid[idx(x, y, width)] = TILE.FLOOR;
}

export function generateFloor(depth, rng, width, height) {
  const grid = new Uint8Array(width * height).fill(TILE.WALL);
  const leaves = splitBSP(1, 1, width - 2, height - 2, rng, 6, 5);

  const rooms = leaves.map(leaf => {
    const roomW = Math.max(3, Math.floor(leaf.w * (0.5 + rng() * 0.4)));
    const roomH = Math.max(3, Math.floor(leaf.h * (0.5 + rng() * 0.4)));
    const roomX = leaf.x + Math.floor(rng() * (leaf.w - roomW));
    const roomY = leaf.y + Math.floor(rng() * (leaf.h - roomH));
    return new Room(roomX, roomY, roomW, roomH);
  });

  rooms.forEach(room => carveRoom(grid, width, room));
  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(grid, width, rooms[i - 1].center(), rooms[i].center());
  }

  const stairsRoom = rooms[rooms.length - 1];
  const stairsDown = stairsRoom.center();
  grid[idx(stairsDown.x, stairsDown.y, width)] = TILE.STAIRS_DOWN;

  return { grid, width, height, rooms, depth, stairsDown };
}

export function isFullyConnected(floor) {
  const { grid, width, height, rooms } = floor;
  if (rooms.length === 0) return true;
  const start = rooms[0].center();
  const seen = new Set([idx(start.x, start.y, width)]);
  const stack = [start];
  const deltas = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (stack.length) {
    const { x, y } = stack.pop();
    for (const [dx, dy] of deltas) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (grid[idx(nx, ny, width)] === TILE.WALL) continue;
      const key = idx(nx, ny, width);
      if (seen.has(key)) continue;
      seen.add(key);
      stack.push({ x: nx, y: ny });
    }
  }
  return rooms.every(r => {
    const c = r.center();
    return seen.has(idx(c.x, c.y, width));
  });
}
