import { CAR, GUARD, TILE } from "./constants";
import {
  DIRS,
  isOpen,
  isWallTile,
  type Maze,
  type Room,
  roomCenter,
  type Vec,
} from "./maze";

export type Guard = {
  home: Room;
  x: number;
  y: number;
  dir: Vec;
  target: Vec; // centro de la próxima sala
  state: "patrol" | "chase" | "confused";
  confusedLeft: number;
};

const roomOfTile = (tx: number, ty: number): Room => ({
  i: (tx - 1) / 2,
  j: (ty - 1) / 2,
});
const opposite = (a: Vec, b: Vec) => a.x === -b.x && a.y === -b.y;

export const patrolSpeed = (round: number) =>
  Math.min(
    GUARD.patrolMax,
    GUARD.patrolSpeed + GUARD.patrolDelta * (round - 1),
  );

function nextCenter(r: Room, d: Vec): Vec {
  return roomCenter({ i: r.i + d.x, j: r.j + d.y });
}

// En una sala: salida al azar que no sea la de vuelta, salvo callejón.
function chooseExit(g: Guard, maze: Maze, r: Room, rng: () => number) {
  const exits = DIRS.filter((d) => isOpen(maze, r, d));
  const ahead = exits.filter((d) => !opposite(d, g.dir));
  const options = ahead.length > 0 ? ahead : exits;
  g.dir = options[Math.floor(rng() * options.length)];
  g.target = nextCenter(r, g.dir);
}

// Vuelve a patrullar desde cualquier punto del pasillo.
function retarget(g: Guard, maze: Maze) {
  const tx = Math.floor(g.x / TILE);
  const ty = Math.floor(g.y / TILE);
  if (tx % 2 === 0 || ty % 2 === 0) {
    // Casilla de conexión: la sala que tiene delante.
    g.target = {
      x: (tx + g.dir.x + 0.5) * TILE,
      y: (ty + g.dir.y + 0.5) * TILE,
    };
    return;
  }
  const r = roomOfTile(tx, ty);
  const c = roomCenter(r);
  const ahead = (c.x - g.x) * g.dir.x + (c.y - g.y) * g.dir.y;
  if (ahead >= 0) g.target = c;
  else if (isOpen(maze, r, g.dir)) g.target = nextCenter(r, g.dir);
  else {
    g.target = c;
    g.dir = { x: -g.dir.x, y: -g.dir.y };
  }
}

export function createGuard(home: Room, maze: Maze, rng: () => number): Guard {
  const exits = DIRS.filter((d) => isOpen(maze, home, d));
  const dir = exits[Math.floor(rng() * exits.length)];
  return {
    home,
    ...roomCenter(home),
    dir,
    target: nextCenter(home, dir),
    state: "patrol",
    confusedLeft: 0,
  };
}

// Dirección hacia el coche si lo ve en su pasillo recto.
function sightDir(g: Guard, maze: Maze, car: Vec): Vec | null {
  const dx = car.x - g.x;
  const dy = car.y - g.y;
  const alongX = Math.abs(dy) <= GUARD.sightBand;
  const alongY = Math.abs(dx) <= GUARD.sightBand;
  if (!alongX && !alongY) return null;
  const horizontal = alongX && (!alongY || Math.abs(dx) >= Math.abs(dy));
  const distance = Math.abs(horizontal ? dx : dy);
  if (distance > GUARD.sightPx) return null;
  const tx = Math.floor(g.x / TILE);
  const ty = Math.floor(g.y / TILE);
  const end = Math.floor((horizontal ? car.x : car.y) / TILE);
  const start = horizontal ? tx : ty;
  for (let t = Math.min(start, end); t <= Math.max(start, end); t++) {
    if (horizontal ? isWallTile(maze, t, ty) : isWallTile(maze, tx, t))
      return null;
  }
  const sign = (horizontal ? dx : dy) < 0 ? -1 : 1;
  return horizontal ? { x: sign, y: 0 } : { x: 0, y: sign };
}

function chase(g: Guard, car: Vec, dir: Vec, budget: number) {
  g.dir = dir;
  const perp: "x" | "y" = dir.x !== 0 ? "y" : "x";
  const along: "x" | "y" = dir.x !== 0 ? "x" : "y";
  // Primero se centra en el pasillo (venía de cruzar la sala de través).
  const center = (Math.floor(g[perp] / TILE) + 0.5) * TILE;
  const fix = center - g[perp];
  const align = Math.min(budget, Math.abs(fix));
  g[perp] += Math.sign(fix) * align;
  const left = car[along] - g[along];
  const move = Math.min(budget - align, Math.abs(left));
  g[along] += Math.sign(left) * move;
}

function patrol(g: Guard, maze: Maze, budget: number, rng: () => number) {
  let left = budget;
  while (left > 0) {
    const dx = g.target.x - g.x;
    const dy = g.target.y - g.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist > left) {
      // Puede quedar una desalineación de la persecución: se corrige primero.
      const perp: "x" | "y" = g.dir.x !== 0 ? "y" : "x";
      const along: "x" | "y" = g.dir.x !== 0 ? "x" : "y";
      const off = g.target[perp] - g[perp];
      const fix = Math.min(left, Math.abs(off));
      g[perp] += Math.sign(off) * fix;
      g[along] += Math.sign(g.target[along] - g[along]) * (left - fix);
      return;
    }
    g.x = g.target.x;
    g.y = g.target.y;
    left -= dist;
    chooseExit(
      g,
      maze,
      roomOfTile(Math.floor(g.x / TILE), Math.floor(g.y / TILE)),
      rng,
    );
  }
}

export function updateGuard(
  g: Guard,
  maze: Maze,
  car: Vec,
  round: number,
  dt: number,
  rng: () => number,
) {
  const speed = patrolSpeed(round);
  if (g.state === "confused") {
    g.confusedLeft -= dt;
    if (g.confusedLeft > 0) return;
    g.state = "patrol";
    retarget(g, maze);
  }
  const dir = sightDir(g, maze, car);
  if (dir) {
    g.state = "chase";
    chase(g, car, dir, (speed + GUARD.chaseExtra) * dt);
  } else if (g.state === "chase") {
    g.state = "confused";
    g.confusedLeft = GUARD.confusedSec;
  } else {
    patrol(g, maze, speed * dt, rng);
  }
}

export function touchesCar(g: Vec, car: Vec): boolean {
  const reach = (GUARD.size + CAR.size) / 2;
  return Math.abs(g.x - car.x) < reach && Math.abs(g.y - car.y) < reach;
}
