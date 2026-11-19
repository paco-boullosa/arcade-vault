import { BLOCK, BOARD_X, COLS, GRAY, H, PANEL_X, ROWS, W } from "./constants";
import { POWERUPS } from "./powerups";
import { type Skin, drawBlock } from "./skins";
import { type Board, type Piece, type PowerKey, fmtTime, ghostY } from "./utils";

export type RenderState = {
  board: Board;
  current: Piece;
  next: Piece;
  score: number;
  lines: number;
  level: number;
  skin: Skin;
  showGhost: boolean;
  gameOver: boolean;
  hideLocked: boolean; // Piezas fantasma: oculta lo fijado salvo los grises
  goal: { text: string; progress: string } | null; // desafío activo
  won: boolean; // victoria de un desafío
  reason: string; // motivo de la derrota ("" si no hay)
  elapsed: number; // ms de partida
  frozen: boolean; // Congelar activo: velo azul sobre el tablero
  flash: { text: string; left: number }; // aviso del power-up (left en ms)
  powerStatus: string; // texto del panel
};

const BG = "#0b0b12";
const BOARD_BG = "#0f0f17";
const LABEL = "#8a8aa0";
const VALUE = "#ffffff";
const ACCENT = "#ffd54f";

// Posición vertical del panel lateral.
const NEXT_Y = 305; // esquina superior de la caja NEXT (4×4 celdas)
const GOAL_Y = 490;
const SKIN_Y = 570;

function drawGrid(ctx: CanvasRenderingContext2D, skin: Skin) {
  ctx.strokeStyle = skin.grid;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let c = 1; c < COLS; c++) {
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
  }
  ctx.stroke();
}

// Borde pulsante e icono del power-up sobre una celda.
function drawPowerIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  key: PowerKey,
) {
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 150);
  ctx.strokeStyle = `rgba(255,255,255,${0.4 + 0.6 * pulse})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(cx * BLOCK + 2, cy * BLOCK + 2, BLOCK - 4, BLOCK - 4);
  ctx.font = `${Math.floor(BLOCK * 0.6)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(
    POWERUPS[key].icon,
    cx * BLOCK + BLOCK / 2,
    cy * BLOCK + BLOCK / 2 + 1,
  );
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  piece: Piece,
  x: number,
  y: number,
  alpha = 1,
) {
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c])
        drawBlock(ctx, skin, x + c, y + r, piece.shape[r][c], BLOCK, alpha);
  // El fantasma (alpha < 1) no lleva icono.
  if (piece.power && alpha === 1) {
    for (let r = 0; r < piece.shape.length; r++)
      for (let c = 0; c < piece.shape[r].length; c++)
        if (piece.shape[r][c]) drawPowerIcon(ctx, x + c, y + r, piece.power);
  }
}

function drawStat(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  y: number,
) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = LABEL;
  ctx.font = "14px monospace";
  ctx.fillText(label, PANEL_X, y);
  ctx.fillStyle = VALUE;
  ctx.font = "bold 28px monospace";
  ctx.fillText(value, PANEL_X, y + 32);
}

function drawBoard(ctx: CanvasRenderingContext2D, s: RenderState) {
  ctx.save();
  ctx.translate(BOARD_X, 0);

  ctx.fillStyle = BOARD_BG;
  ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK);
  drawGrid(ctx, s.skin);

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (!(s.hideLocked && !s.gameOver && s.board[r][c] < GRAY))
        drawBlock(ctx, s.skin, c, r, s.board[r][c], BLOCK);

  if (!s.gameOver) {
    if (s.showGhost) {
      drawPiece(
        ctx,
        s.skin,
        s.current,
        s.current.x,
        ghostY(s.board, s.current),
        0.2,
      );
    }
    drawPiece(ctx, s.skin, s.current, s.current.x, s.current.y);
  }

  // Congelado: velo azul.
  if (s.frozen) {
    ctx.fillStyle = "rgba(100, 181, 246, 0.18)";
    ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK);
  }

  // Aviso del power-up.
  if (s.flash.left > 0) {
    ctx.globalAlpha = Math.min(1, s.flash.left / 300);
    ctx.font = "bold 30px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 5;
    ctx.strokeStyle = BG;
    ctx.strokeText(s.flash.text, (COLS * BLOCK) / 2, (ROWS * BLOCK) / 3);
    ctx.fillStyle = ACCENT;
    ctx.fillText(s.flash.text, (COLS * BLOCK) / 2, (ROWS * BLOCK) / 3);
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = "#3a3a4e";
  ctx.lineWidth = 2;
  ctx.strokeRect(-1, -1, COLS * BLOCK + 2, ROWS * BLOCK + 2);
  ctx.restore();
}

function drawPanel(ctx: CanvasRenderingContext2D, s: RenderState) {
  drawStat(ctx, "SCORE", s.score.toLocaleString("es-ES"), 50);
  drawStat(ctx, "LINES", String(s.lines), 120);
  drawStat(ctx, "LEVEL", String(s.level), 190);

  // NEXT: caja de 4×4 celdas con la pieza centrada.
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = LABEL;
  ctx.font = "14px monospace";
  ctx.fillText("NEXT", PANEL_X, NEXT_Y - 12);
  ctx.fillStyle = BOARD_BG;
  ctx.fillRect(PANEL_X, NEXT_Y, 4 * BLOCK, 4 * BLOCK);
  ctx.strokeStyle = "#3a3a4e";
  ctx.lineWidth = 1;
  ctx.strokeRect(PANEL_X + 0.5, NEXT_Y + 0.5, 4 * BLOCK - 1, 4 * BLOCK - 1);

  const shape = s.next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  ctx.save();
  ctx.translate(PANEL_X, NEXT_Y);
  drawPiece(ctx, s.skin, s.next, offX, offY);
  ctx.restore();

  // Estado del power-up.
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = s.frozen || s.next.power ? ACCENT : LABEL;
  ctx.font = "16px monospace";
  ctx.fillText(s.powerStatus, PANEL_X, NEXT_Y + 4 * BLOCK + 28);

  // Objetivo y progreso del desafío.
  if (s.goal) {
    ctx.fillStyle = LABEL;
    ctx.font = "14px monospace";
    ctx.fillText("OBJETIVO", PANEL_X, GOAL_Y);
    ctx.fillStyle = VALUE;
    ctx.font = "12px monospace";
    ctx.fillText(s.goal.text, PANEL_X, GOAL_Y + 20);
    ctx.fillStyle = ACCENT;
    ctx.font = "bold 16px monospace";
    ctx.fillText(s.goal.progress, PANEL_X, GOAL_Y + 44);
  }

  // Skin y ayuda de teclas.
  ctx.fillStyle = LABEL;
  ctx.font = "14px monospace";
  ctx.fillText("SKIN", PANEL_X, SKIN_Y);
  ctx.fillStyle = ACCENT;
  ctx.font = "bold 14px monospace";
  ctx.fillText(s.skin.name, PANEL_X + 56, SKIN_Y);
  ctx.fillStyle = LABEL;
  ctx.font = "12px monospace";
  ctx.fillText("G FANTASMA · S SKIN", PANEL_X, SKIN_Y + 22);
}

// Pantalla de fin: título, motivo, puntuación y tiempo (en desafíos).
function drawEnd(ctx: CanvasRenderingContext2D, s: RenderState) {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const cx = W / 2;
  let y = H / 2 - 50;

  ctx.fillStyle = s.won ? "#81c784" : "#e57373";
  ctx.font = "bold 46px monospace";
  ctx.fillText(s.won ? "¡DESAFÍO SUPERADO!" : "GAME OVER", cx, y);

  ctx.fillStyle = LABEL;
  if (s.reason) {
    y += 34;
    ctx.font = "18px monospace";
    ctx.fillText(s.reason, cx, y);
  }
  y += 40;
  ctx.fillStyle = VALUE;
  ctx.font = "bold 24px monospace";
  ctx.fillText(`Puntuación: ${s.score.toLocaleString("es-ES")}`, cx, y);
  if (s.goal) {
    y += 32;
    ctx.fillStyle = LABEL;
    ctx.font = "18px monospace";
    ctx.fillText(`Tiempo: ${fmtTime(s.elapsed)}`, cx, y);
  }
  y += 50;
  ctx.fillStyle = ACCENT;
  ctx.font = "14px monospace";
  ctx.fillText("ESPACIO REINICIAR · M MENÚ", cx, y);
  ctx.textAlign = "left";
}

// Velo de pausa sobre lo que haya dibujado.
export function drawPause(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ACCENT;
  ctx.font = "bold 46px monospace";
  ctx.fillText("PAUSA", W / 2, H / 2 - 10);
  ctx.fillStyle = LABEL;
  ctx.font = "14px monospace";
  ctx.fillText("P / ESC PARA CONTINUAR", W / 2, H / 2 + 34);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

// Dibuja un fotograma completo en el canvas de 800×600.
export function drawScene(ctx: CanvasRenderingContext2D, s: RenderState) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  drawBoard(ctx, s);
  drawPanel(ctx, s);
  if (s.gameOver) drawEnd(ctx, s);
}

// Menú de modos dibujado en el canvas, antes de cada partida.
export function drawMenu(
  ctx: CanvasRenderingContext2D,
  modes: { name: string; desc: string }[],
  selected: number,
  skinName: string,
) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = ACCENT;
  ctx.font = "bold 52px monospace";
  ctx.fillText("TETRIS", W / 2, 76);
  ctx.fillStyle = LABEL;
  ctx.font = "14px monospace";
  ctx.fillText("ELIGE UN MODO", W / 2, 106);

  const rowW = 560;
  const rowH = 56;
  const x0 = (W - rowW) / 2;
  modes.forEach((m, i) => {
    const y = 130 + i * (rowH + 8);
    const on = i === selected;
    ctx.fillStyle = on ? "#1c1c2c" : BOARD_BG;
    ctx.fillRect(x0, y, rowW, rowH);
    ctx.strokeStyle = on ? ACCENT : "#2a2a3a";
    ctx.lineWidth = on ? 2 : 1;
    ctx.strokeRect(x0 + 1, y + 1, rowW - 2, rowH - 2);

    ctx.textAlign = "left";
    ctx.fillStyle = on ? ACCENT : VALUE;
    ctx.font = "bold 20px monospace";
    ctx.fillText(`${on ? "▶ " : "  "}${m.name}`, x0 + 18, y + 26);
    ctx.fillStyle = LABEL;
    ctx.font = "12px monospace";
    ctx.fillText(m.desc, x0 + 40, y + 45);
  });

  ctx.textAlign = "center";
  ctx.fillStyle = LABEL;
  ctx.font = "13px monospace";
  ctx.fillText("↑ ↓ ELEGIR · ENTER / ESPACIO EMPEZAR", W / 2, 566);
  ctx.fillText(`S SKIN: ${skinName} · G FANTASMA`, W / 2, 586);
  ctx.textAlign = "left";
}
