import { CFG, COLS, ROWS } from "./constants";
import { FRUIT_COUNT } from "./sprites";

// Reglas puras: reciben el estado por argumento y no tocan DOM, tiempo ni
// estado global. El motor (engine.ts) es quien guarda el estado.

export type Cell = { x: number; y: number };
export type Dir = "up" | "down" | "left" | "right";
export type Fruit = Cell & { sprite: number };

export const DIR_VEC: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

// Nivel = 1 + floor(frutas / 5). Sin tope.
export function levelFor(fruitsEaten: number): number {
  return 1 + Math.floor(fruitsEaten / CFG.fruitsPerLevel);
}

// Intervalo de paso en ms: max(60, 140 - 8 * (level - 1)).
export function stepInterval(level: number): number {
  return Math.max(CFG.stepMsMin, CFG.stepMs - CFG.stepMsDelta * (level - 1));
}

// Un giro es valido si no repite `reference` ni va en sentido contrario (180°).
// `reference` es el ultimo giro en cola o, si no hay, la direccion actual.
export function canTurn(reference: Dir, next: Dir): boolean {
  return next !== reference && next !== OPPOSITE[reference];
}

export type StepResult =
  | { kind: "moved"; snake: Cell[] }
  | { kind: "ate"; snake: Cell[] }
  | { kind: "dead"; snake: Cell[] };

// Avanza un paso. La cabeza es snake[0].
// - Fuera de la rejilla o contra el cuerpo: "dead" (la serpiente no cambia).
// - Moverse a la celda que deja libre la cola en este paso NO mata, salvo que
//   se coma la fruta (entonces la cola no se retira y esa celda sigue ocupada).
// - Si la cabeza llega a la fruta: "ate", la serpiente crece una celda.
export function step(
  snake: readonly Cell[],
  dir: Dir,
  fruit: Cell | null,
  cols: number = COLS,
  rows: number = ROWS,
): StepResult {
  const v = DIR_VEC[dir];
  const head = { x: snake[0].x + v.x, y: snake[0].y + v.y };

  if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
    return { kind: "dead", snake: [...snake] };
  }

  const ate = fruit !== null && head.x === fruit.x && head.y === fruit.y;
  const body = ate ? snake : snake.slice(0, -1);

  if (body.some((c) => c.x === head.x && c.y === head.y)) {
    return { kind: "dead", snake: [...snake] };
  }

  return { kind: ate ? "ate" : "moved", snake: [head, ...body] };
}

// Elige una celda libre al azar entre las celdas libres calculadas (sin
// reintentos) y un sprite 0..21 distinto de `prevSprite`.
// Devuelve null si no queda ninguna celda libre (victoria).
export function spawnFruit(
  snake: readonly Cell[],
  prevSprite: number,
  rng: () => number = Math.random,
  cols: number = COLS,
  rows: number = ROWS,
): Fruit | null {
  const occupied = new Set(snake.map((c) => c.y * cols + c.x));
  const free: Cell[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!occupied.has(y * cols + x)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;

  const cell = free[Math.floor(rng() * free.length)];

  // Sprite distinto del anterior: se elige entre los FRUIT_COUNT - 1 restantes.
  let sprite = Math.floor(rng() * (FRUIT_COUNT - 1));
  if (prevSprite >= 0 && sprite >= prevSprite) sprite += 1;

  return { x: cell.x, y: cell.y, sprite };
}
