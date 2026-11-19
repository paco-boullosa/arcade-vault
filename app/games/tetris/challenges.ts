import { COLS, GARBAGE_EVERY, GRAY, ROWS, TIME_LIMIT } from "./constants";
import { type Board, countGray, fmtTime } from "./utils";

export type ModeId =
  "classic" | "sprint" | "garbage" | "fixed" | "invisible" | "reverse";

// Lo que un desafío necesita saber de la partida.
export type ChallengeState = {
  board: Board;
  lines: number;
  level: number;
  elapsed: number; // ms de partida (no avanza en pausa)
  garbageAccum: number; // ms desde la última fila de basura
};

export type Mode = {
  id: ModeId;
  name: string;
  desc: string;
  startLevel: number;
};

export type Challenge = Mode & {
  goal: string;
  progress: (s: ChallengeState) => string;
  setup?: (board: Board) => void;
  garbage?: boolean; // sube una fila gris cada GARBAGE_EVERY ms
  checkWin?: (s: ChallengeState) => boolean;
  checkLose?: (s: ChallengeState) => string | null; // motivo o null
};

export const CLASSIC: Mode = {
  id: "classic",
  name: "Clásico",
  desc: "Juego libre sin objetivo",
  startLevel: 1,
};

export const CHALLENGES: Challenge[] = [
  {
    id: "sprint",
    name: "Sprint 40",
    desc: "Limpia 40 líneas en 2 minutos",
    startLevel: 1,
    goal: "Limpia 40 líneas en 2:00",
    progress: (s) => `${s.lines}/40 · ${fmtTime(TIME_LIMIT - s.elapsed)}`,
    checkWin: (s) => s.lines >= 40,
    checkLose: (s) => (s.elapsed >= TIME_LIMIT ? "Se acabó el tiempo" : null),
  },
  {
    id: "garbage",
    name: "Marea de basura",
    desc: "Sobrevive 2 minutos con basura subiendo cada 10 s",
    startLevel: 1,
    goal: "Sobrevive 2:00 (sube basura cada 10 s)",
    progress: (s) =>
      `${fmtTime(TIME_LIMIT - s.elapsed)} · basura en ${Math.ceil(
        (GARBAGE_EVERY - s.garbageAccum) / 1000,
      )}s`,
    garbage: true,
    checkWin: (s) => s.elapsed >= TIME_LIMIT,
  },
  {
    id: "fixed",
    name: "Bloques fijos",
    desc: "Elimina todos los bloques grises pre-colocados",
    startLevel: 1,
    goal: "Elimina todos los bloques grises",
    progress: (s) => `${countGray(s.board, GRAY)} bloques restantes`,
    setup(board) {
      // Seis filas inferiores, cada una con un hueco.
      for (let r = ROWS - 6; r < ROWS; r++) {
        const hole = Math.floor(Math.random() * COLS);
        for (let c = 0; c < COLS; c++)
          if (c !== hole && Math.random() < 0.65) board[r][c] = GRAY;
      }
    },
    checkWin: (s) => countGray(s.board, GRAY) === 0,
  },
  {
    id: "invisible",
    name: "Piezas fantasma",
    desc: "Las piezas se vuelven invisibles al fijarse. Limpia 20 líneas",
    startLevel: 1,
    goal: "Limpia 20 líneas (piezas invisibles)",
    progress: (s) => `${s.lines}/20`,
    checkWin: (s) => s.lines >= 20,
  },
  {
    id: "reverse",
    name: "Rotación inversa",
    desc: "Empiezas en nivel 5; desde el nivel 6 la rotación se invierte. Llega al nivel 8",
    startLevel: 5,
    goal: "Llega al nivel 8 (rotación inversa desde nivel 6)",
    progress: (s) =>
      `Nivel ${s.level}/8${s.level >= 6 ? " · ROT. INVERSA" : ""}`,
    checkWin: (s) => s.level >= 8,
  },
];

// Entradas del menú, en orden.
export const MENU_MODES: Mode[] = [CLASSIC, ...CHALLENGES];

export function findMode(id: ModeId): Challenge | null {
  return CHALLENGES.find((m) => m.id === id) ?? null;
}

// Rotación antihoraria en Rotación inversa desde el nivel 6.
export function reverseRotation(mode: Mode | null, level: number): boolean {
  return mode?.id === "reverse" && level >= 6;
}

// Sube una fila gris con un hueco aleatorio (muta `board`). Devuelve `false`
// si la fila superior ya estaba ocupada y no se pudo subir.
export function pushGarbageRow(board: Board): boolean {
  if (board[0].some((v) => v)) return false;
  const hole = Math.floor(Math.random() * COLS);
  const row = new Array<number>(COLS).fill(GRAY);
  row[hole] = 0;
  board.shift();
  board.push(row);
  return true;
}
