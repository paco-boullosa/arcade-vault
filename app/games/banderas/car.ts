import { CAM_MAX_X, CAM_MAX_Y, CAR, TILE, VIEW_H, W } from "./constants";
import { isWallAt, isWallTile, type Maze, type Vec } from "./maze";

const HALF = CAR.size / 2;
const EDGE = 0.001; // el borde derecho/inferior no cuenta como la casilla siguiente

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export function camera(carX: number, carY: number): Vec {
  return {
    x: clamp(carX - W / 2, 0, CAM_MAX_X),
    y: clamp(carY - VIEW_H / 2, 0, CAM_MAX_Y),
  };
}

// Avanza `step` px (menos que medio coche) y se queda pegado al muro si lo hay.
function advance(maze: Maze, p: Vec, d: Vec, step: number): Vec {
  const alongX = d.x !== 0;
  const sign = alongX ? d.x : d.y;
  const pos = (alongX ? p.x : p.y) + sign * step;
  const side = alongX ? p.y : p.x;
  const front = pos + sign * (HALF - EDGE);
  const blocked = [side - HALF + EDGE, side + HALF - EDGE].some((s) =>
    alongX ? isWallAt(maze, front, s) : isWallAt(maze, s, front),
  );
  let next = pos;
  if (blocked) {
    const tile = Math.floor(front / TILE);
    next = sign > 0 ? tile * TILE - HALF : (tile + 1) * TILE + HALF;
  }
  return alongX ? { x: next, y: p.y } : { x: p.x, y: next };
}

export function moveCar(maze: Maze, p: Vec, d: Vec, dt: number): Vec {
  let step = CAR.speed * dt;
  let cur = p;
  const alongX = d.x !== 0;
  const tx = Math.floor(p.x / TILE);
  const ty = Math.floor(p.y / TILE);
  const offset = alongX ? (ty + 0.5) * TILE - p.y : (tx + 0.5) * TILE - p.x;

  // Ayuda de giro: solo si la casilla pedida está libre y la esquina estorba.
  if (
    !isWallTile(maze, tx + d.x, ty + d.y) &&
    Math.abs(offset) > TILE / 2 - HALF &&
    Math.abs(offset) <= CAR.turnAssist
  ) {
    const slide = Math.min(step, Math.abs(offset)) * Math.sign(offset);
    cur = alongX ? { x: p.x, y: p.y + slide } : { x: p.x + slide, y: p.y };
    step -= Math.abs(slide);
    // Sin terminar de alinear no se puede girar todavía.
    if (Math.abs(offset) - Math.abs(slide) > 0) return cur;
  }
  return advance(maze, cur, d, step);
}
