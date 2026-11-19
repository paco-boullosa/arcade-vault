import { COLS, FREEZE_MS, ROWS, WILD, WILD_MS } from "./constants";
import type { Board, Piece, PowerKey } from "./utils";

export const POWERUPS: Record<
  PowerKey,
  { name: string; icon: string; flash: string }
> = {
  bomb: { name: "Bomba", icon: "💣", flash: "¡BOMBA!" },
  ray: { name: "Rayo", icon: "⚡", flash: "¡RAYO!" },
  tint: { name: "Tinte", icon: "🎨", flash: "¡TINTE!" },
  gravity: { name: "Gravedad", icon: "⬇️", flash: "¡GRAVEDAD!" },
  freeze: { name: "Congelar", icon: "❄️", flash: "¡CONGELADO!" },
};

export const POWER_KEYS = Object.keys(POWERUPS) as PowerKey[];

export function randomPower(rng: () => number = Math.random): PowerKey {
  return POWER_KEYS[Math.floor(rng() * POWER_KEYS.length)];
}

// Centro (redondeado) de las celdas ocupadas de la pieza, dentro del tablero.
export function pieceCenter(p: Piece): { cx: number; cy: number } {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let r = 0; r < p.shape.length; r++)
    for (let c = 0; c < p.shape[r].length; c++)
      if (p.shape[r][c]) {
        sx += p.x + c;
        sy += p.y + r;
        n++;
      }
  return {
    cx: Math.min(COLS - 1, Math.max(0, Math.round(sx / n))),
    cy: Math.min(ROWS - 1, Math.max(0, Math.round(sy / n))),
  };
}

// Gravedad: cada columna cae hasta el fondo (muta `board`).
export function compactBoard(board: Board): void {
  for (let c = 0; c < COLS; c++) {
    const col: number[] = [];
    for (let r = 0; r < ROWS; r++) if (board[r][c]) col.push(board[r][c]);
    for (let r = ROWS - 1; r >= 0; r--) board[r][c] = col.pop() ?? 0;
  }
}

// Tinte: al acabar el efecto se borran los bloques comodín (muta `board`).
export function clearWild(board: Board): void {
  for (const row of board)
    for (let c = 0; c < COLS; c++) if (row[c] === WILD) row[c] = 0;
}

// Efectos con duración que el motor debe cronometrar.
export type PowerEffect = { freezeMs: number; wildMs: number };

// Aplica el power-up de la pieza recién fijada (muta `board`). No suma puntos.
export function applyPowerUp(board: Board, p: Piece): PowerEffect {
  const effect: PowerEffect = { freezeMs: 0, wildMs: 0 };
  if (!p.power) return effect;
  const { cx, cy } = pieceCenter(p);
  switch (p.power) {
    case "bomb":
      for (let r = cy - 1; r <= cy + 1; r++)
        for (let c = cx - 1; c <= cx + 1; c++)
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = 0;
      break;
    case "ray":
      for (let c = 0; c < COLS; c++) board[cy][c] = 0;
      for (let r = 0; r < ROWS; r++) board[r][cx] = 0;
      break;
    case "tint":
      for (const row of board)
        for (let c = 0; c < COLS; c++) if (row[c] === p.type) row[c] = WILD;
      effect.wildMs = WILD_MS;
      break;
    case "gravity":
      compactBoard(board);
      break;
    case "freeze":
      effect.freezeMs = FREEZE_MS;
      break;
  }
  return effect;
}

// Texto del panel: congelado, power-up en camino o líneas que faltan.
export function powerStatusText(
  freezeLeft: number,
  next: Piece,
  linesToNext: number,
): string {
  if (freezeLeft > 0) return `❄️ Congelado ${Math.ceil(freezeLeft / 1000)}s`;
  if (next.power) {
    const p = POWERUPS[next.power];
    return `Siguiente: ${p.icon} ${p.name}`;
  }
  return `en ${Math.max(0, linesToNext)} líneas`;
}
