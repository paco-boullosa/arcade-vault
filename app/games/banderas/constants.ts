export const W = 800;
export const H = 600;
export const HUD_H = 40; // franja superior del HUD; el visor va de y = 40 a y = 600
export const VIEW_H = H - HUD_H; // 560

export const TILE = 40;
export const ROOMS_X = 20; // salas en horizontal
export const ROOMS_Y = 15;
export const COLS = 2 * ROOMS_X + 1; // 41 casillas
export const ROWS = 2 * ROOMS_Y + 1; // 31
export const MAP_W = COLS * TILE; // 1640 px
export const MAP_H = ROWS * TILE; // 1240 px
export const CAM_MAX_X = MAP_W - W; // 840
export const CAM_MAX_Y = MAP_H - VIEW_H; // 680

export const MAZE = {
  seedBase: 18018, // semilla de la ronda r = seedBase + r
  extraLoops: 40, // muros interiores que se abren tras el árbol
  startRoom: { i: 10, j: 7 }, // sala de salida (casilla 21, 15)
} as const;

export const CAR = {
  size: 24, // caja de colisión y dibujo (cuadrado)
  speed: 200, // px/s
  turnAssist: 14, // px de tolerancia para alinear un giro
  startX: 860, // centro de la sala de salida
  startY: 620,
  respawnInvulnMs: 2000,
} as const;

export const MAST = {
  perRound: 8,
  holdRadius: 16, // px: el centro del coche debe estar a esta distancia del mástil
  holdSec: 1.0,
  minBfs: 10, // pasos de sala mínimos desde la salida
  minPair: 6, // distancia Manhattan mínima entre mástiles (en salas)
  minPairFloor: 3,
} as const;

export const GUARD = {
  size: 24,
  base: 2, // vigías = min(max, base + ronda)
  max: 7,
  patrolSpeed: 100, // ronda 1
  patrolDelta: 10,
  patrolMax: 150,
  chaseExtra: 40, // persecución = patrulla + 40 (máx. 190 < 200)
  sightPx: 320, // alcance de visión (8 casillas)
  sightBand: 12, // desalineación lateral máxima para verte
  confusedSec: 1.5,
  minBfs: 12, // pasos de sala mínimos desde la salida
  minPair: 3,
} as const;

export const SCORE = {
  mast: 200,
  rhythmBonus: 100, // si se iza a ≤ 20 s del anterior (o del inicio de la ronda)
  rhythmSec: 20,
  roundBase: 500,
  roundPerParSec: 10,
  extraLifeEvery: 5000,
  max: 9999999,
} as const;

export const CFG = {
  lives: 3,
  maxLives: 5,
  parBase: 150, // s en la ronda 1
  parDelta: 10, // se resta por ronda
  parMin: 90,
  deathMs: 1200,
  clearMs: 2000,
  dtMax: 0.05, // s
} as const;

// Aspecto: formas del canvas, sin sprites.
export const COLORS = {
  bg: "#05070d",
  floor: "#0b1f14",
  wall: "#0f3a22",
  line: "#39ff88",
  car: "#ffffff",
  guard: "#ff3860",
  flag: "#ffd400",
  text: "#e8fff1",
} as const;
