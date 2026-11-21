import {
  CELL,
  CFG,
  COLS,
  HOMES,
  HOME_W,
  ROW_ROAD_BOTTOM,
  ROW_ROAD_TOP,
  ROW_RIVER_BOTTOM,
  ROW_RIVER_TOP,
} from "./constants";
import { LANE_BY_ROW, type Lane } from "./lanes";

/** Estado temporal de los carriles: segundos de juego y multiplicador de velocidad. */
export type LaneState = { t: number; m: number };

export type TurtleState = "surface" | "warn" | "sub" | "emerge";

export type FrogPos = { x: number; row: number };

export type Platform = { lane: Lane; x: number };

/** Multiplicador de velocidad: min(2, 1 + 0,15 × (level − 1)). */
export function speedMul(level: number): number {
  return Math.min(
    CFG.speedMax,
    1 + CFG.speedPerLevel * (Math.max(1, level) - 1),
  );
}

/** Tiempo por rana en ms: max(20000, 30000 − 2000 × (level − 1)). */
export function timeFor(level: number): number {
  return Math.max(
    CFG.timeMsMin,
    CFG.timeMs - CFG.timeMsDelta * (Math.max(1, level) - 1),
  );
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/**
 * Posición x (px) del objeto `k` del carril en el instante `t` (s) con
 * multiplicador `m`: ((x0 + dir × v × m × t) mod L) − len × 40, con x0 = k × spacing.
 * El objeto ocupa [x, x + len × 40).
 */
export function laneX(lane: Lane, t: number, m: number, k = 0): number {
  const x0 = k * lane.spacing;
  return mod(x0 + lane.dir * lane.v * m * t, lane.L) - lane.len * CELL;
}

/** Estado de inmersión a partir de la fase (ms) dentro del ciclo de 6000 ms. */
export function turtleState(phaseMs: number): TurtleState {
  const p = mod(phaseMs, CFG.diveCycleMs);
  if (p < CFG.diveWarnFrom) return "surface";
  if (p < CFG.diveSubFrom) return "warn";
  if (p < CFG.diveSubTo) return "sub";
  return "emerge";
}

/** Estado de las tortugas de un carril en el instante `t` (s). */
export function laneTurtleState(lane: Lane, t: number): TurtleState {
  return turtleState(t * 1000 + lane.phaseMs);
}

/** ¿Es una plataforma sumergida (mortal)? */
export function isSubmerged(lane: Lane, t: number): boolean {
  return lane.kind === "turtle" && laneTurtleState(lane, t) === "sub";
}

/**
 * Plataforma del río bajo `centerX` en la fila `row`, o null si no hay o está
 * sumergida. Solo mira el centro horizontal de la rana.
 */
export function platformAt(
  row: number,
  centerX: number,
  state: LaneState,
): Platform | null {
  if (row < ROW_RIVER_TOP || row > ROW_RIVER_BOTTOM) return null;
  const lane = LANE_BY_ROW[row];
  if (!lane) return null;
  if (isSubmerged(lane, state.t)) return null;
  for (let k = 0; k < lane.count; k++) {
    const x = laneX(lane, state.t, state.m, k);
    if (centerX >= x && centerX < x + lane.len * CELL) return { lane, x };
  }
  return null;
}

/**
 * Colisión de la rana con un vehículo (solo filas de carretera). Caja de la
 * rana: frogHit × frogHit centrada en la celda; vehículo: len × 40 de ancho y
 * vehicleHitH de alto, centrado en la fila.
 */
export function hitsVehicle(frog: FrogPos, state: LaneState): boolean {
  if (frog.row < ROW_ROAD_TOP || frog.row > ROW_ROAD_BOTTOM) return false;
  const lane = LANE_BY_ROW[frog.row];
  if (!lane) return false;
  const fx0 = frog.x + (CELL - CFG.frogHit) / 2;
  const fx1 = fx0 + CFG.frogHit;
  const fy0 = frog.row * CELL + (CELL - CFG.frogHit) / 2;
  const fy1 = fy0 + CFG.frogHit;
  const vy0 = frog.row * CELL + (CELL - CFG.vehicleHitH) / 2;
  const vy1 = vy0 + CFG.vehicleHitH;
  if (fy1 <= vy0 || fy0 >= vy1) return false;
  for (let k = 0; k < lane.count; k++) {
    const vx0 = laneX(lane, state.t, state.m, k);
    const vx1 = vx0 + lane.len * CELL;
    if (fx1 > vx0 && fx0 < vx1) return true;
  }
  return false;
}

/**
 * Índice (0..4) del hueco de meta vacío que contiene `centerX`, o −1 si cae
 * fuera de un hueco o en uno ya lleno (ambos casos matan).
 */
export function homeAt(centerX: number, filled: readonly boolean[]): number {
  for (let i = 0; i < HOMES.length; i++) {
    const x0 = HOMES[i] * CELL;
    if (centerX >= x0 && centerX < x0 + HOME_W) return filled[i] ? -1 : i;
  }
  return -1;
}

/** Aterrizaje fuera del río: celda más cercana, con tope 0..(COLS − 1) × 40. */
export function landX(x: number): number {
  const snapped = Math.round(x / CELL) * CELL;
  return Math.min((COLS - 1) * CELL, Math.max(0, snapped));
}

/** Tope de puntuación del `CHECK` de `scores`. */
export function clampScore(score: number): number {
  return Math.min(CFG.maxScore, score);
}
