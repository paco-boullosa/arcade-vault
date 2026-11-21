import {
  CELL,
  H,
  HOMES,
  HOME_W,
  ROW_GOAL,
  ROW_MEDIAN,
  ROW_RIVER_BOTTOM,
  ROW_RIVER_TOP,
  ROW_ROAD_BOTTOM,
  ROW_ROAD_TOP,
  ROW_START,
  W,
} from "./constants";
import { LANES, type Lane } from "./lanes";
import { laneTurtleState, laneX } from "./logic";
import type { Skin } from "./skins";

const FONT = "monospace";

type Phase = "ready" | "playing" | "dying" | "levelclear" | "gameover";
type Dir = "up" | "down" | "left" | "right";

export type View = {
  phase: Phase;
  paused: boolean;
  score: number;
  lives: number;
  level: number;
  filled: readonly boolean[];
  frogX: number;
  frogRow: number;
  prevX: number;
  prevRow: number;
  hop: number; // 0..1: progreso del salto (1 = aterrizado)
  facing: Dir;
  death: number; // 0..1: progreso de la animacion de muerte
  deathCause: "car" | "water" | "time" | "goal";
  timeFrac: number; // 0..1 del reloj de rana
  laneT: number;
  m: number;
};

const ANGLE: Record<Dir, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

function rowY(row: number): number {
  return row * CELL;
}

// ---- Fondo ----

function drawBackground(ctx: CanvasRenderingContext2D, sk: Skin) {
  ctx.fillStyle = sk.bg;
  ctx.fillRect(0, 0, W, H);

  // Meta
  ctx.fillStyle = sk.goal;
  ctx.fillRect(0, rowY(ROW_GOAL), W, CELL);

  // Rio
  ctx.fillStyle = sk.water;
  ctx.fillRect(
    0,
    rowY(ROW_RIVER_TOP),
    W,
    (ROW_RIVER_BOTTOM - ROW_RIVER_TOP + 1) * CELL,
  );
  ctx.strokeStyle = sk.waterWave;
  ctx.lineWidth = 2;
  for (let r = ROW_RIVER_TOP; r <= ROW_RIVER_BOTTOM; r++) {
    for (let x = (r % 2) * 20; x < W; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, rowY(r) + 20);
      ctx.quadraticCurveTo(x + 10, rowY(r) + 14, x + 20, rowY(r) + 20);
      ctx.quadraticCurveTo(x + 30, rowY(r) + 26, x + 40, rowY(r) + 20);
      ctx.stroke();
    }
  }

  // Mediana
  ctx.fillStyle = sk.median;
  ctx.fillRect(0, rowY(ROW_MEDIAN), W, CELL);
  ctx.fillStyle = sk.medianEdge;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, rowY(ROW_MEDIAN), W, 2);
  ctx.fillRect(0, rowY(ROW_MEDIAN) + CELL - 2, W, 2);
  ctx.globalAlpha = 1;

  // Carretera
  ctx.fillStyle = sk.road;
  ctx.fillRect(
    0,
    rowY(ROW_ROAD_TOP),
    W,
    (ROW_ROAD_BOTTOM - ROW_ROAD_TOP + 1) * CELL,
  );
  ctx.strokeStyle = sk.roadLine;
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 16]);
  for (let r = ROW_ROAD_TOP + 1; r <= ROW_ROAD_BOTTOM; r++) {
    ctx.beginPath();
    ctx.moveTo(0, rowY(r));
    ctx.lineTo(W, rowY(r));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Salida
  ctx.fillStyle = sk.start;
  ctx.fillRect(0, rowY(ROW_START), W, CELL);
}

function drawGoal(
  ctx: CanvasRenderingContext2D,
  sk: Skin,
  filled: readonly boolean[],
) {
  // Muros entre huecos
  ctx.fillStyle = sk.goalEdge;
  ctx.globalAlpha = 0.18;
  ctx.fillRect(0, rowY(ROW_GOAL), W, CELL);
  ctx.globalAlpha = 1;
  HOMES.forEach((col, i) => {
    const x = col * CELL;
    ctx.fillStyle = sk.water;
    ctx.fillRect(x, rowY(ROW_GOAL), HOME_W, CELL);
    ctx.strokeStyle = sk.goalEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, rowY(ROW_GOAL) + 1, HOME_W - 2, CELL - 2);
    if (filled[i]) {
      drawFrog(ctx, sk, x + HOME_W / 2, rowY(ROW_GOAL) + CELL / 2, "down", {
        scale: 0.85,
      });
    }
  });
}

// ---- Objetos de carril ----

function vehicleColor(sk: Skin, lane: Lane): string {
  switch (lane.kind) {
    case "bus":
      return sk.bus;
    case "truck":
      return sk.truck;
    case "fastcar":
      return sk.cyan;
    default:
      return lane.row === 7 || lane.row === 13 ? sk.magenta : sk.yellow;
  }
}

function drawLog(
  ctx: CanvasRenderingContext2D,
  sk: Skin,
  x: number,
  row: number,
  len: number,
) {
  const w = len * CELL;
  const y = rowY(row) + 6;
  const outline = sk.style === "outline";
  ctx.fillStyle = sk.log;
  if (outline) ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.roundRect(x + 1, y, w - 2, CELL - 12, 10);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = outline ? sk.log : sk.logLight;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  ctx.lineWidth = 2;
  for (let c = 1; c < len; c++) {
    ctx.beginPath();
    ctx.moveTo(x + c * CELL, y + 3);
    ctx.lineTo(x + c * CELL, y + CELL - 15);
    ctx.stroke();
  }
}

function drawTurtles(
  ctx: CanvasRenderingContext2D,
  sk: Skin,
  lane: Lane,
  x: number,
  t: number,
) {
  const state = laneTurtleState(lane, t);
  let alpha = 1;
  if (state === "warn") {
    // Parpadeo de aviso: 150 ms visible, 150 ms apagada.
    alpha = Math.floor((t * 1000) / 150) % 2 === 0 ? 1 : 0.25;
  } else if (state === "sub") {
    alpha = 0.12; // solo se intuye bajo el agua
  } else if (state === "emerge") {
    alpha = 0.6;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let c = 0; c < lane.len; c++) {
    const cx = x + c * CELL + CELL / 2;
    const cy = rowY(lane.row) + CELL / 2;
    ctx.fillStyle = sk.shell;
    if (sk.style === "outline") ctx.globalAlpha = alpha * 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = sk.style === "outline" ? sk.shell : sk.shellLight;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy);
    ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx, cy + 8);
    ctx.stroke();
    // Cabeza hacia delante
    ctx.fillStyle = sk.shellLight;
    ctx.beginPath();
    ctx.arc(cx + lane.dir * 16, cy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  sk: Skin,
  lane: Lane,
  x: number,
) {
  const w = lane.len * CELL;
  const y = rowY(lane.row) + 7;
  const h = CELL - 14;
  const color = vehicleColor(sk, lane);
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.round(sk.glow * 0.8);
  const outline = sk.style === "outline";
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  // Contorno con relleno de alfa bajo (neon) o relleno pleno.
  const paint = (px: number, pw: number, c: string) => {
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
    if (outline) {
      ctx.globalAlpha = 0.28;
      ctx.fillRect(px, y, pw, h);
      ctx.globalAlpha = 1;
      ctx.strokeRect(px + 1, y + 1, pw - 2, h - 2);
    } else {
      ctx.fillRect(px, y, pw, h);
    }
  };
  if (lane.kind === "truck") {
    // Cabina delante, remolque detras
    const cab = CELL - 6;
    const cabX = lane.dir === 1 ? x + w - cab - 2 : x + 2;
    const trX = lane.dir === 1 ? x + 2 : x + cab + 4;
    paint(trX, w - cab - 6, color);
    paint(cabX, cab, sk.yellow);
  } else if (outline) {
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.roundRect(x + 2, y, w - 4, h, 5);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 1, w - 6, h - 2, 5);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.roundRect(x + 2, y, w - 4, h, 5);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  // Parabrisas y faros en el frente
  const front = lane.dir === 1 ? x + w - 2 : x + 2;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(lane.dir === 1 ? front - 12 : front + 4, y + 3, 8, h - 6);
  ctx.fillStyle = sk.ink;
  ctx.fillRect(front - (lane.dir === 1 ? 3 : 0), y + 2, 3, 4);
  ctx.fillRect(front - (lane.dir === 1 ? 3 : 0), y + h - 6, 3, 4);
  ctx.restore();
}

function drawLanes(ctx: CanvasRenderingContext2D, sk: Skin, v: View) {
  for (const lane of LANES) {
    for (let k = 0; k < lane.count; k++) {
      const x = laneX(lane, v.laneT, v.m, k);
      if (x >= W || x + lane.len * CELL <= 0) continue;
      if (lane.kind === "log") drawLog(ctx, sk, x, lane.row, lane.len);
      else if (lane.kind === "turtle") drawTurtles(ctx, sk, lane, x, v.laneT);
      else drawVehicle(ctx, sk, lane, x);
    }
  }
}

// ---- Rana ----

type FrogOpts = {
  scale?: number;
  squashX?: number;
  squashY?: number;
  color?: string;
  alpha?: number;
};

function drawFrog(
  ctx: CanvasRenderingContext2D,
  sk: Skin,
  cx: number,
  cy: number,
  facing: Dir,
  o: FrogOpts = {},
) {
  const color = o.color ?? sk.frog;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ANGLE[facing]);
  const s = o.scale ?? 1;
  ctx.scale(s * (o.squashX ?? 1), s * (o.squashY ?? 1));
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.shadowColor = color;
  ctx.shadowBlur = sk.glow;
  ctx.fillStyle = color;
  // Patas
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * 12, 8, 5, 7, sx * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sx * 12, -8, 4, 5, -sx * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cuerpo
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Ojos hacia delante
  for (const sx of [-1, 1]) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(sx * 6, -9, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(sx * 6, -10.5, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayerFrog(ctx: CanvasRenderingContext2D, sk: Skin, v: View) {
  if (v.phase === "levelclear") return;
  const p = v.phase === "dying" ? 1 : v.hop;
  const x = v.prevX + (v.frogX - v.prevX) * p;
  const row = v.prevRow + (v.frogRow - v.prevRow) * p;
  const lift = v.phase === "dying" ? 0 : Math.sin(Math.PI * p) * 0.18;
  const cx = x + CELL / 2;
  const cy = rowY(row) + CELL / 2;

  if (v.phase === "dying") {
    const q = v.death;
    if (v.deathCause === "water") {
      ctx.save();
      ctx.strokeStyle = sk.cyan;
      ctx.lineWidth = 2;
      for (let i = 0; i < 2; i++) {
        const r = 8 + (q + i * 0.3) * 26;
        ctx.globalAlpha = Math.max(0, 1 - q - i * 0.15);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      drawFrog(ctx, sk, cx, cy, v.facing, { scale: 1 - q * 0.7, alpha: 1 - q });
      return;
    }
    // Atropello, tiempo agotado o caida en la meta: aplastada y roja, parpadeo.
    const blink = Math.floor(q * 8) % 2 === 0;
    drawFrog(ctx, sk, cx, cy, v.facing, {
      color: blink ? sk.dead : sk.ink,
      squashX: 1 + q * 0.7,
      squashY: 1 - q * 0.75,
      alpha: q > 0.75 ? 1 - (q - 0.75) * 4 : 1,
    });
    return;
  }
  drawFrog(ctx, sk, cx, cy, v.facing, { scale: 1 + lift });
}

// ---- HUD del canvas (fila 14) ----

function drawHud(ctx: CanvasRenderingContext2D, sk: Skin, v: View) {
  const y = rowY(ROW_START) + CELL / 2;
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.fillStyle = sk.ink;
  ctx.font = `bold 16px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(`PUNTOS ${String(v.score).padStart(6, "0")}`, 12, y);
  ctx.fillText(`NIVEL ${String(v.level).padStart(2, "0")}`, 215, y);

  // Vidas (a la derecha de la celda de salida de la rana)
  ctx.fillStyle = sk.magenta;
  ctx.font = `bold 20px ${FONT}`;
  for (let i = 0; i < v.lives; i++) ctx.fillText("♥", 432 + i * 24, y);

  // Nombre de la skin (tecla K)
  ctx.fillStyle = sk.inkDim;
  ctx.font = `12px ${FONT}`;
  ctx.fillText(sk.name.toUpperCase(), 512, y);

  // Barra de tiempo
  const bx = 580;
  const bw = W - bx - 12;
  const frac = Math.max(0, Math.min(1, v.timeFrac));
  ctx.fillStyle = "rgba(230, 233, 255, 0.12)";
  ctx.fillRect(bx, y - 6, bw, 12);
  ctx.fillStyle = frac > 0.5 ? sk.frog : frac > 0.25 ? sk.yellow : sk.magenta;
  ctx.fillRect(bx, y - 6, bw * frac, 12);
  ctx.restore();
}

// ---- Pantallas ----

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  sk: Skin,
  title: string,
  sub?: string,
) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = sk.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = sk.dead;
  ctx.shadowBlur = sk.glow > 0 ? 12 : 0;
  ctx.font = `bold 48px ${FONT}`;
  ctx.fillText(title, W / 2, sub ? H / 2 - 20 : H / 2);
  if (sub) {
    ctx.shadowBlur = 0;
    ctx.font = `20px ${FONT}`;
    ctx.fillText(sub, W / 2, H / 2 + 30);
  }
  ctx.restore();
}

function drawBanner(
  ctx: CanvasRenderingContext2D,
  sk: Skin,
  text: string,
  row: number,
) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, rowY(row), W, CELL);
  ctx.fillStyle = sk.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillText(text, W / 2, rowY(row) + CELL / 2);
  ctx.restore();
}

export function drawScene(ctx: CanvasRenderingContext2D, v: View, sk: Skin) {
  ctx.clearRect(0, 0, W, H);
  drawBackground(ctx, sk);
  drawGoal(ctx, sk, v.filled);
  drawLanes(ctx, sk, v);
  drawPlayerFrog(ctx, sk, v);
  drawHud(ctx, sk, v);

  if (v.paused) {
    drawOverlay(ctx, sk, "PAUSA");
  } else if (v.phase === "gameover") {
    drawOverlay(ctx, sk, "Game over", `Puntos: ${v.score}`);
  } else if (v.phase === "levelclear") {
    drawBanner(
      ctx,
      sk,
      `¡NIVEL ${String(v.level).padStart(2, "0")} COMPLETADO!`,
      ROW_MEDIAN,
    );
  } else if (v.phase === "ready") {
    // Sin atenuar para ver el tablero; el aviso va sobre la mediana.
    drawBanner(ctx, sk, "Pulsa una flecha para empezar", ROW_MEDIAN);
  }
}
