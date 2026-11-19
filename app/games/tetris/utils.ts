import { COLS, KICKS, LINE_SCORES, ROWS } from "./constants";

// Matriz ROWS × COLS: 0 = vacío, 1–7 = pieza, 8 = gris, 9 = comodín.
export type Board = number[][];
export type Shape = number[][];
export type PowerKey = "bomb" | "ray" | "tint" | "gravity" | "freeze";

export type Piece = {
  type: number; // 1–7
  shape: Shape;
  x: number;
  y: number;
  power?: PowerKey;
};

// Índice = tipo de pieza (el 0 no se usa). I, O, T, S, Z, J, L.
export const PIECES: (Shape | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
];

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

// Pieza nueva en su posición de aparición: x = 5 - floor(ancho / 2), y = 0.
export function randomPiece(rng: () => number = Math.random): Piece {
  const type = Math.floor(rng() * 7) + 1;
  const shape = PIECES[type]!.map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

export function collide(
  board: Board,
  shape: Shape,
  ox: number,
  oy: number,
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

export function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

export function rotateCCW(shape: Shape): Shape {
  return rotateCW(rotateCW(rotateCW(shape)));
}

// Rota con los kicks horizontales. Devuelve la forma y el desplazamiento de x
// del primer intento libre, o `null` si ninguno cabe.
export function tryRotate(
  board: Board,
  piece: Piece,
  counterClockwise: boolean,
): { shape: Shape; x: number } | null {
  const rotated = counterClockwise
    ? rotateCCW(piece.shape)
    : rotateCW(piece.shape);
  for (const kick of KICKS) {
    if (!collide(board, rotated, piece.x + kick, piece.y)) {
      return { shape: rotated, x: piece.x + kick };
    }
  }
  return null;
}

// Fila a la que llegaría la pieza con una caída libre.
export function ghostY(board: Board, piece: Piece): number {
  let gy = piece.y;
  while (!collide(board, piece.shape, piece.x, gy + 1)) gy++;
  return gy;
}

// Escribe la pieza en el tablero (muta `board`).
export function merge(board: Board, piece: Piece): void {
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c])
        board[piece.y + r][piece.x + c] = piece.shape[r][c];
}

// Elimina las filas completas (muta `board`) y devuelve cuántas eran.
export function clearFullRows(board: Board): number {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((v) => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array<number>(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  return cleared;
}

// Puntos por limpiar `n` líneas con el nivel previo a recalcularlo.
export function lineScore(n: number, level: number): number {
  return (LINE_SCORES[n] ?? 0) * level;
}

export function levelFor(startLevel: number, lines: number): number {
  return startLevel + Math.floor(lines / 10);
}

// Milisegundos entre caídas automáticas.
export function dropIntervalFor(level: number): number {
  return Math.max(100, 1000 - (level - 1) * 90);
}

export function countGray(board: Board, gray: number): number {
  let n = 0;
  for (const row of board) for (const v of row) if (v === gray) n++;
  return n;
}

export function fmtTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
