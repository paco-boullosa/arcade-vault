import { CELL, COLS, H, ROWS, W } from "./constants";
import { type Cell, type Dir, type Fruit, DIR_VEC } from "./logic";
import type { Sprites } from "./sprites";

// Dibujo de Snake: aspecto neon de la plataforma. La serpiente son formas del
// canvas; solo las frutas son sprites.

export type View = {
  phase: "ready" | "playing" | "gameover" | "won";
  paused: boolean;
  snake: readonly Cell[];
  dir: Dir;
  fruit: Fruit | null;
  score: number;
  level: number;
};

const BG = "#0a0a0f";
const GRID = "rgba(0, 245, 255, 0.07)";
const GREEN = "#00ff88";
const GREEN_HEAD = "#7dffc0";
const MAGENTA = "#ff006e"; // serpiente muerta
const INK = "#e6e9ff";
const FONT = "monospace";

const center = (c: Cell) => ({
  x: c.x * CELL + CELL / 2,
  y: c.y * CELL + CELL / 2,
});

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= COLS; x++) {
    ctx.moveTo(x * CELL + 0.5, 0);
    ctx.lineTo(x * CELL + 0.5, H);
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.moveTo(0, y * CELL + 0.5);
    ctx.lineTo(W, y * CELL + 0.5);
  }
  ctx.stroke();
}

function drawSnake(ctx: CanvasRenderingContext2D, v: View) {
  const dead = v.phase === "gameover";
  const color = dead ? MAGENTA : GREEN;
  const headColor = dead ? MAGENTA : GREEN_HEAD;
  const pts = v.snake.map(center);

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  pts.forEach((p, i) =>
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
  );

  // Resplandor, cuerpo y nucleo claro.
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = color;
  ctx.lineWidth = CELL - 10;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = 8;
  ctx.stroke();

  // Cabeza algo mayor que el cuerpo.
  const h = pts[0];
  const size = CELL - 4;
  ctx.shadowColor = headColor;
  ctx.shadowBlur = 18;
  ctx.fillStyle = headColor;
  ctx.beginPath();
  ctx.roundRect(h.x - size / 2, h.y - size / 2, size, size, 10);
  ctx.fill();
  ctx.restore();

  // Ojos segun la direccion.
  const d = DIR_VEC[v.dir];
  const px = -d.y;
  const py = d.x;
  for (const side of [-1, 1]) {
    const ex = h.x + d.x * 6 + px * side * 7;
    const ey = h.y + d.y * 6 + py * side * 7;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(ex, ey, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = BG;
    ctx.beginPath();
    ctx.arc(ex + d.x * 1.5, ey + d.y * 1.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHud(ctx: CanvasRenderingContext2D, v: View) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = `bold 20px ${FONT}`;
  ctx.textBaseline = "top";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 6;
  ctx.textAlign = "left";
  ctx.fillText(`Puntos: ${v.score}`, 16, 12);
  ctx.textAlign = "right";
  ctx.fillText(`Nivel ${v.level}`, W - 16, 12);
  ctx.restore();
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  title: string,
  sub?: string,
) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = MAGENTA;
  ctx.shadowBlur = 12;
  ctx.font = `bold 48px ${FONT}`;
  ctx.fillText(title, W / 2, sub ? H / 2 - 20 : H / 2);
  if (sub) {
    ctx.shadowBlur = 0;
    ctx.font = `20px ${FONT}`;
    ctx.fillText(sub, W / 2, H / 2 + 30);
  }
  ctx.restore();
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  v: View,
  sprites: Sprites,
) {
  ctx.clearRect(0, 0, W, H);
  drawGrid(ctx);

  if (v.fruit) {
    const c = center(v.fruit);
    sprites.drawFruit(ctx, v.fruit.sprite, c.x, c.y);
  }
  drawSnake(ctx, v);
  drawHud(ctx, v);

  if (v.paused) {
    drawOverlay(ctx, "PAUSA");
  } else if (v.phase === "gameover") {
    drawOverlay(ctx, "Game over", `Puntos: ${v.score}`);
  } else if (v.phase === "won") {
    drawOverlay(ctx, "Has ganado", `Puntos: ${v.score}`);
  } else if (v.phase === "ready") {
    // Sin atenuar para ver la serpiente y la fruta; el aviso va bajo la serpiente.
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, H / 2 + 60, W, 50);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText("Pulsa una flecha para empezar", W / 2, H / 2 + 85);
    ctx.restore();
  }
}
