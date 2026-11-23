import {
  COLS,
  GUARD,
  MAST,
  MAZE,
  ROOMS_X,
  ROOMS_Y,
  ROWS,
  TILE,
} from "./constants";
import { mulberry32, shuffle } from "./rng";

export type Room = { i: number; j: number };
export type Vec = { x: number; y: number };
// 1 = muro, 0 = transitable; índice y * COLS + x.
export type Maze = Uint8Array;

// N, E, S, O
export const DIRS: readonly Vec[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const tileIndex = (x: number, y: number) => y * COLS + x;
const roomIndex = (r: Room) => r.j * ROOMS_X + r.i;

export const roomCenter = (r: Room): Vec => ({
  x: 80 * r.i + 60,
  y: 80 * r.j + 60,
});

export const guardCount = (round: number) =>
  Math.min(GUARD.max, GUARD.base + round);

export function isWallTile(maze: Maze, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
  return maze[tileIndex(x, y)] === 1;
}

export function isWallAt(maze: Maze, px: number, py: number): boolean {
  return isWallTile(maze, Math.floor(px / TILE), Math.floor(py / TILE));
}

// ¿Está abierta la conexión de la sala en esa dirección?
export function isOpen(maze: Maze, r: Room, d: Vec): boolean {
  return !isWallTile(maze, 2 * r.i + 1 + d.x, 2 * r.j + 1 + d.y);
}

// Árbol en profundidad (299 conexiones) más 40 bucles. Solo se abren muros,
// así que todas las salas son alcanzables.
export function generateMaze(round: number): Maze {
  const rng = mulberry32(MAZE.seedBase + round);
  const maze = new Uint8Array(COLS * ROWS).fill(1);
  const open = (r: Room, d: Vec) => {
    maze[tileIndex(2 * r.i + 1 + d.x, 2 * r.j + 1 + d.y)] = 0;
  };
  const visited = new Uint8Array(ROOMS_X * ROOMS_Y);
  const visit = (r: Room) => {
    visited[roomIndex(r)] = 1;
    maze[tileIndex(2 * r.i + 1, 2 * r.j + 1)] = 0;
  };

  const stack: Room[] = [{ i: 0, j: 0 }];
  visit(stack[0]);
  while (stack.length > 0) {
    const r = stack[stack.length - 1];
    const options = DIRS.filter((d) => {
      const i = r.i + d.x;
      const j = r.j + d.y;
      return (
        i >= 0 &&
        j >= 0 &&
        i < ROOMS_X &&
        j < ROOMS_Y &&
        !visited[roomIndex({ i, j })]
      );
    });
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const d = options[Math.floor(rng() * options.length)];
    const next = { i: r.i + d.x, j: r.j + d.y };
    open(r, d);
    visit(next);
    stack.push(next);
  }

  const closed: { r: Room; d: Vec }[] = [];
  for (let j = 0; j < ROOMS_Y; j++) {
    for (let i = 0; i < ROOMS_X; i++) {
      const r = { i, j };
      if (i < ROOMS_X - 1 && !isOpen(maze, r, DIRS[1]))
        closed.push({ r, d: DIRS[1] });
      if (j < ROOMS_Y - 1 && !isOpen(maze, r, DIRS[2]))
        closed.push({ r, d: DIRS[2] });
    }
  }
  for (const c of shuffle(closed, rng).slice(0, MAZE.extraLoops))
    open(c.r, c.d);
  return maze;
}

// Pasos de sala desde la salida; -1 = inalcanzable.
export function bfsRooms(maze: Maze): Int16Array {
  const dist = new Int16Array(ROOMS_X * ROOMS_Y).fill(-1);
  const queue: Room[] = [MAZE.startRoom];
  dist[roomIndex(MAZE.startRoom)] = 0;
  for (let q = 0; q < queue.length; q++) {
    const r = queue[q];
    for (const d of DIRS) {
      if (!isOpen(maze, r, d)) continue;
      const next = { i: r.i + d.x, j: r.j + d.y };
      if (dist[roomIndex(next)] >= 0) continue;
      dist[roomIndex(next)] = dist[roomIndex(r)] + 1;
      queue.push(next);
    }
  }
  return dist;
}

const manhattan = (a: Room, b: Room) =>
  Math.abs(a.i - b.i) + Math.abs(a.j - b.j);

function roomsFrom(dist: Int16Array, min: number): Room[] {
  const out: Room[] = [];
  for (let j = 0; j < ROOMS_Y; j++)
    for (let i = 0; i < ROOMS_X; i++)
      if (dist[roomIndex({ i, j })] >= min) out.push({ i, j });
  return out;
}

function pickSpaced(candidates: Room[], count: number, minPair: number) {
  const out: Room[] = [];
  for (const c of candidates) {
    if (out.length === count) break;
    if (out.every((o) => manhattan(o, c) >= minPair)) out.push(c);
  }
  return out;
}

export function pickMasts(dist: Int16Array, rng: () => number): Room[] {
  const candidates = shuffle(roomsFrom(dist, MAST.minBfs), rng);
  let masts: Room[] = [];
  for (let min: number = MAST.minPair; min >= MAST.minPairFloor; min--) {
    masts = pickSpaced(candidates, MAST.perRound, min);
    if (masts.length === MAST.perRound) break;
  }
  return masts;
}

export function pickGuards(
  dist: Int16Array,
  masts: Room[],
  round: number,
  rng: () => number,
): Room[] {
  const candidates = roomsFrom(dist, GUARD.minBfs).filter((r) =>
    masts.every((m) => manhattan(m, r) > 0),
  );
  return pickSpaced(shuffle(candidates, rng), guardCount(round), GUARD.minPair);
}

export function buildRound(round: number) {
  const maze = generateMaze(round);
  const dist = bfsRooms(maze);
  const rng = mulberry32((MAZE.seedBase + round) * 2 + 1);
  const masts = pickMasts(dist, rng);
  const guards = pickGuards(dist, masts, round, rng);
  // La secuencia sigue con los giros de los vigías.
  return { maze, masts, guards, rng };
}
