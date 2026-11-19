export const W = 800;
export const H = 600;

export const CFG = {
  paddle: { w: 120, h: 14, y: 560, speed: 480 }, // speed en px/s
  ball: { size: 16 },
  block: { w: 64, h: 32, cols: 10, rows: 7, offsetX: 80, offsetY: 60 },
  lives: 3,
  maxLives: 5,
  pointsPerBlock: 10,
  pointsPerHardBlock: 20,
};

export const ROW_COLORS = [
  "red",
  "yellow",
  "cyan",
  "magenta",
  "hotpink",
  "green",
  "gray",
] as const;

export type BlockColor = (typeof ROW_COLORS)[number];

export type Level = {
  name: string;
  ballSpeed: number; // px/s
  hardGray: boolean;
  mask: (r: number, c: number) => boolean;
};

// mask(r, c) devuelve true si la celda (fila r, columna c) lleva bloque
export const LEVELS: Level[] = [
  { name: "Rejilla", ballSpeed: 320, hardGray: false, mask: () => true },
  {
    name: "Pirámide",
    ballSpeed: 350,
    hardGray: true,
    mask: (r, c) => Math.abs(c - 4.5) <= 1 + r * 0.75,
  },
  {
    name: "Tablero",
    ballSpeed: 380,
    hardGray: true,
    mask: (r, c) => (r + c) % 2 === 0,
  },
  {
    name: "Rombo",
    ballSpeed: 410,
    hardGray: true,
    mask: (r, c) => Math.abs(c - 4.5) <= 1 + 1.2 * (3 - Math.abs(r - 3)),
  },
  {
    name: "Franjas",
    ballSpeed: 440,
    hardGray: true,
    mask: (r) => r % 2 === 0,
  },
];

export const EXPLOSION_DURATION = 150; // ms, 4 frames
