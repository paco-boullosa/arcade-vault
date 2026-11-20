import { CELL, COLS, H, ROWS, W } from "./constants";
import { type Cell, type Dir, type Fruit, DIR_VEC } from "./logic";
import type { Skin } from "./skins";
import type { Sprites } from "./sprites";

// Dibujo de Snake. La serpiente son formas del canvas; las frutas son sprites
// en Clásico y formas del canvas en Retro y Neon. Colores y estilo vienen de la skin.

export type View = {
  phase: "ready" | "playing" | "gameover" | "won";
  paused: boolean;
  snake: readonly Cell[];
  dir: Dir;
  fruit: Fruit | null;
  score: number;
  level: number;
};

const FONT = "monospace";

const center = (c: Cell) => ({
  x: c.x * CELL + CELL / 2,
  y: c.y * CELL + CELL / 2,
});

function drawGrid(ctx: CanvasRenderingContext2D, skin: Skin) {
  ctx.fillStyle = skin.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = skin.grid;
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

function drawFruit(
  ctx: CanvasRenderingContext2D,
  v: View,
  skin: Skin,
  sprites: Sprites,
) {
  if (!v.fruit) return;
  const c = center(v.fruit);
  if (skin.fruitStyle === "sprite") {
    sprites.drawFruit(ctx, v.fruit.sprite, c.x, c.y);
    return;
  }
  ctx.save();
  if (skin.fruitStyle === "square") {
    ctx.fillStyle = skin.fruit;
    ctx.fillRect(c.x - 10, c.y - 10, 20, 20);
  } else {
    ctx.shadowColor = skin.fruit;
    ctx.shadowBlur = skin.glow;
    ctx.fillStyle = skin.fruit;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = skin.fruit;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

function drawSnake(ctx: CanvasRenderingContext2D, v: View, skin: Skin) {
  const dead = v.phase === "gameover";
  const color = dead ? skin.dead : skin.body;
  const headColor = dead ? skin.dead : skin.head;
  const pts = v.snake.map(center);
  const h = pts[0];

  ctx.save();
  if (skin.bodyStyle === "blocks") {
    // Celdas planas, sin curvas ni resplandor.
    ctx.fillStyle = color;
    const size = CELL - 6;
    for (let i = 1; i < pts.length; i++) {
      ctx.fillRect(pts[i].x - size / 2, pts[i].y - size / 2, size, size);
    }
    ctx.fillStyle = headColor;
    ctx.fillRect(h.x - (CELL - 2) / 2, h.y - (CELL - 2) / 2, CELL - 2, CELL - 2);
  } else {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    pts.forEach((p, i) =>
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
    );
    ctx.shadowColor = color;
    ctx.shadowBlur = skin.glow;
    ctx.strokeStyle = color;
    ctx.lineWidth = CELL - 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (skin.bodyStyle === "glow-line") {
      // Resplandor, cuerpo y nucleo claro.
      ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
      ctx.lineWidth = 8;
      ctx.stroke();
    } else {
      // Contorno: se vacia el interior y se rellena con alfa bajo.
      ctx.strokeStyle = skin.bg;
      ctx.lineWidth = CELL - 17;
      ctx.stroke();
      ctx.strokeStyle = skin.bodyFill;
      ctx.stroke();
    }

    // Cabeza algo mayor que el cuerpo.
    const size = CELL - 4;
    ctx.shadowColor = headColor;
    ctx.shadowBlur = skin.glow > 0 ? skin.glow + 2 : 0;
    ctx.fillStyle = headColor;
    ctx.beginPath();
    ctx.roundRect(h.x - size / 2, h.y - size / 2, size, size, 10);
    ctx.fill();
  }
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
    ctx.fillStyle = skin.bg;
    ctx.beginPath();
    ctx.arc(ex + d.x * 1.5, ey + d.y * 1.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHud(ctx: CanvasRenderingContext2D, v: View, skin: Skin) {
  ctx.save();
  ctx.fillStyle = skin.ink;
  ctx.font = `bold 20px ${FONT}`;
  ctx.textBaseline = "top";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 6;
  ctx.textAlign = "left";
  ctx.fillText(`Puntos: ${v.score}`, 16, 12);
  ctx.textAlign = "right";
  ctx.fillText(`Nivel ${v.level}`, W - 16, 12);
  ctx.shadowBlur = 0;
  ctx.fillStyle = skin.inkDim;
  ctx.font = `14px ${FONT}`;
  ctx.textBaseline = "bottom";
  ctx.fillText(`SKIN ${skin.name.toUpperCase()}`, W - 16, H - 10);
  ctx.restore();
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  title: string,
  sub?: string,
) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = skin.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = skin.dead;
  ctx.shadowBlur = skin.glow > 0 ? 12 : 0;
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
  skin: Skin,
) {
  ctx.clearRect(0, 0, W, H);
  drawGrid(ctx, skin);

  drawFruit(ctx, v, skin, sprites);
  drawSnake(ctx, v, skin);
  drawHud(ctx, v, skin);

  if (v.paused) {
    drawOverlay(ctx, skin, "PAUSA");
  } else if (v.phase === "gameover") {
    drawOverlay(ctx, skin, "Game over", `Puntos: ${v.score}`);
  } else if (v.phase === "won") {
    drawOverlay(ctx, skin, "Has ganado", `Puntos: ${v.score}`);
  } else if (v.phase === "ready") {
    // Sin atenuar para ver la serpiente y la fruta; el aviso va bajo la serpiente.
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, H / 2 + 60, W, 50);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = skin.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText("Pulsa una flecha para empezar", W / 2, H / 2 + 85);
    ctx.restore();
  }
}
