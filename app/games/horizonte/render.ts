import { H, HUD_H, PLAY_TOP, TERRAIN, W } from "./constants";
import {
  type Enemy,
  type EnemyBullet,
  type Gate,
  type Ship,
  type Shot,
  drawBullet,
  drawEnemy,
  drawGate,
  drawShip,
  drawShot,
} from "./entities";
import { mulberry32 } from "./rng";
import type { Skin } from "./skins";
import type { Terrain } from "./terrain";

const FONT = "monospace";

// Duración de la explosión de la nave (las 8 partículas); la fase `dying`
// dura más (CFG.deathMs), el resto del tiempo se ve solo el escenario.
export const EXPLOSION_MS = 500;
const PARTICLES = 8;

export type Star = { x: number; y: number; size: number };
export type Explosion = { x: number; y: number; ageMs: number };

export type View = {
  phase: "ready" | "playing" | "dying" | "gameover";
  paused: boolean;
  dist: number;
  score: number;
  lives: number;
  sector: number;
  terrain: Terrain;
  ship: Ship;
  shipVisible: boolean;
  shots: Shot[];
  enemies: Enemy[];
  bullets: EnemyBullet[];
  gate: Gate | null;
  explosion: Explosion | null;
  stars: [Star[], Star[]];
};

// Dos capas de 60 estrellas. Solo es decorado, así que usa su propia semilla.
export function createStars(): [Star[], Star[]] {
  const rand = mulberry32(777);
  const layer = (size: number): Star[] =>
    Array.from({ length: 60 }, () => ({
      x: rand() * W,
      y: PLAY_TOP + rand() * (H - PLAY_TOP),
      size,
    }));
  return [layer(1), layer(2)];
}

// Paralaje: la capa lejana va a 0,2× y la cercana a 0,5× el scroll.
const STAR_SPEED = [0.2, 0.5];
const STAR_ALPHA = [0.45, 0.85];

function drawStars(ctx: CanvasRenderingContext2D, v: View, skin: Skin) {
  ctx.save();
  for (let l = 0; l < 2; l++) {
    ctx.globalAlpha = STAR_ALPHA[l];
    ctx.fillStyle = skin.star;
    for (const s of v.stars[l]) {
      const x = (((s.x - v.dist * STAR_SPEED[l]) % W) + W) % W;
      ctx.fillRect(x, s.y, s.size, s.size);
    }
  }
  ctx.restore();
}

// Techo y suelo columna a columna: relleno y borde cian de 2 px solo en el
// filo del hueco (no a lo largo del lado cerrado por el HUD o el marco).
function drawTerrain(ctx: CanvasRenderingContext2D, v: View, skin: Skin) {
  const col = TERRAIN.col;
  const first = Math.floor(v.dist / col);
  const last = Math.floor((v.dist + W) / col) + 1;
  const startX = first * col - v.dist;
  const endX = (last + 1) * col - v.dist;

  const ceilFill = new Path2D();
  const floorFill = new Path2D();
  const ceilEdge = new Path2D();
  const floorEdge = new Path2D();
  ceilFill.moveTo(startX, PLAY_TOP);
  floorFill.moveTo(startX, H);
  for (let i = first; i <= last; i++) {
    const x = i * col - v.dist;
    const c = v.terrain.ceilAt(i * col);
    const f = v.terrain.floorAt(i * col);
    ceilFill.lineTo(x, c);
    ceilFill.lineTo(x + col, c);
    floorFill.lineTo(x, f);
    floorFill.lineTo(x + col, f);
    if (i === first) {
      ceilEdge.moveTo(x, c);
      floorEdge.moveTo(x, f);
    } else {
      ceilEdge.lineTo(x, c);
      floorEdge.lineTo(x, f);
    }
    ceilEdge.lineTo(x + col, c);
    floorEdge.lineTo(x + col, f);
  }
  ceilFill.lineTo(endX, PLAY_TOP);
  ceilFill.closePath();
  floorFill.lineTo(endX, H);
  floorFill.closePath();

  ctx.save();
  ctx.fillStyle = skin.terrainFill;
  ctx.fill(ceilFill);
  ctx.fill(floorFill);
  ctx.lineWidth = 2;
  ctx.strokeStyle = skin.terrainEdge;
  // Resplandor solo en el filo (un único trazo por techo y suelo).
  if (skin.style === "outline") {
    ctx.shadowColor = skin.terrainEdge;
    ctx.shadowBlur = skin.glow;
  }
  ctx.stroke(ceilEdge);
  ctx.stroke(floorEdge);
  ctx.restore();
}

// 8 partículas que salen en abanico, se encogen y se desvanecen en 0,5 s.
function drawExplosion(
  ctx: CanvasRenderingContext2D,
  e: Explosion,
  skin: Skin,
) {
  const q = e.ageMs / EXPLOSION_MS;
  if (q >= 1) return;
  const colors = skin.burst;
  ctx.save();
  ctx.globalAlpha = 1 - q;
  for (let i = 0; i < PARTICLES; i++) {
    const a = (Math.PI * 2 * i) / PARTICLES + 0.3;
    const d = 8 + 70 * q;
    const size = 6 * (1 - q) + 1;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(
      e.x + Math.cos(a) * d - size / 2,
      e.y + Math.sin(a) * d - size / 2,
      size,
      size,
    );
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = skin.burstRing;
  ctx.beginPath();
  ctx.arc(e.x, e.y, 10 + 40 * q, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---- HUD del canvas (franja de 40 px) ----

function drawHud(ctx: CanvasRenderingContext2D, v: View, skin: Skin) {
  const y = HUD_H / 2;
  ctx.save();
  ctx.fillStyle = skin.hudBg;
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = skin.hudLine;
  ctx.fillRect(0, HUD_H - 1, W, 1);

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = skin.ink;
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillText(`PUNTOS ${String(v.score).padStart(6, "0")}`, 12, y);
  ctx.fillText(`SECTOR ${String(v.sector).padStart(2, "0")}`, 215, y);

  // Vidas: una nave pequeña por cada una.
  ctx.fillStyle = skin.lives;
  for (let i = 0; i < v.lives; i++) {
    const x = 372 + i * 26;
    ctx.beginPath();
    ctx.moveTo(x + 10, y);
    ctx.lineTo(x - 8, y - 7);
    ctx.lineTo(x - 4, y);
    ctx.lineTo(x - 8, y + 7);
    ctx.closePath();
    ctx.fill();
  }

  // Vida restante de la puerta mientras está en pantalla.
  const g = v.gate;
  if (g && g.x < W) {
    const bx = 580;
    const bw = W - bx - 12;
    ctx.fillStyle = skin.gateBar;
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillText("PUERTA", bx - 66, y);
    ctx.fillStyle = skin.hudTrack;
    ctx.fillRect(bx, y - 6, bw, 12);
    ctx.fillStyle = skin.gateBar;
    ctx.fillRect(bx, y - 6, bw * Math.max(0, g.hp / g.hpMax), 12);
  }

  // Nombre de la skin y su tecla, debajo de la barra de la puerta.
  ctx.textAlign = "right";
  ctx.fillStyle = skin.inkDim;
  ctx.font = `bold 10px ${FONT}`;
  ctx.fillText(`K · SKIN ${skin.name.toUpperCase()}`, W - 12, HUD_H - 7);
  ctx.restore();
}

// ---- Pantallas ----

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
  ctx.shadowColor = skin.glowColor;
  ctx.shadowBlur = skin.style === "flat" ? 0 : 12;
  ctx.font = `bold 48px ${FONT}`;
  ctx.fillText(title, W / 2, sub ? H / 2 - 20 : H / 2);
  if (sub) {
    ctx.shadowBlur = 0;
    ctx.font = `20px ${FONT}`;
    ctx.fillText(sub, W / 2, H / 2 + 30);
  }
  ctx.restore();
}

function drawReadyPrompt(ctx: CanvasRenderingContext2D, skin: Skin) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(0, PLAY_TOP, W, H - PLAY_TOP);
  ctx.fillStyle = skin.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = skin.glowColor;
  ctx.shadowBlur = skin.style === "flat" ? 0 : 12;
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillText("Pulsa ESPACIO para despegar", W / 2, H / 2);
  ctx.restore();
}

export function drawScene(ctx: CanvasRenderingContext2D, v: View, skin: Skin) {
  ctx.fillStyle = skin.bg;
  ctx.fillRect(0, 0, W, H);
  drawStars(ctx, v, skin);
  drawTerrain(ctx, v, skin);
  if (v.gate) drawGate(ctx, v.gate, v, skin);
  // Los Dardos y Enjambres atraviesan el terreno: se dibujan delante.
  for (const e of v.enemies) drawEnemy(ctx, e, skin);
  for (const b of v.bullets) drawBullet(ctx, b, skin);
  for (const s of v.shots) drawShot(ctx, s, skin);
  if (v.shipVisible) drawShip(ctx, v.ship, skin);
  if (v.explosion) drawExplosion(ctx, v.explosion, skin);
  drawHud(ctx, v, skin);

  if (v.paused) {
    drawOverlay(ctx, skin, "PAUSA");
  } else if (v.phase === "gameover") {
    drawOverlay(ctx, skin, "Game over", `Puntos: ${v.score}`);
  } else if (v.phase === "ready") {
    drawReadyPrompt(ctx, skin);
  }
}
