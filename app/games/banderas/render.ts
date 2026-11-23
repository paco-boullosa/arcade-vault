import { camera } from "./car";
import { CAR, GUARD, H, HUD_H, TILE, VIEW_H, W } from "./constants";
import type { Guard } from "./guards";
import { isWallTile, type Maze, type Vec } from "./maze";
import type { Skin } from "./skins";

export type Phase = "ready" | "playing" | "dead" | "clear" | "gameover";
export type Mast = Vec & { progress: number; raised: boolean };

export type Scene = {
  phase: Phase;
  paused: boolean;
  score: number;
  lives: number;
  round: number;
  maze: Maze;
  masts: Mast[];
  guards: Guard[];
  car: Vec;
  facing: Vec;
  invulnerable: boolean;
  par: number;
  deathTime: number;
  clearBonus: number;
  time: number;
};

type Ctx = CanvasRenderingContext2D;

function drawMaze(ctx: Ctx, k: Skin, maze: Maze, cam: Vec) {
  const x0 = Math.floor(cam.x / TILE);
  const y0 = Math.floor(cam.y / TILE);
  const x1 = Math.ceil((cam.x + W) / TILE);
  const y1 = Math.ceil((cam.y + VIEW_H) / TILE);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      ctx.fillStyle = isWallTile(maze, x, y) ? k.wall : k.floor;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
  // Filo de 2 px solo donde el muro da a un pasillo.
  ctx.fillStyle = k.line;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!isWallTile(maze, x, y)) continue;
      const px = x * TILE;
      const py = y * TILE;
      if (!isWallTile(maze, x, y - 1)) ctx.fillRect(px, py, TILE, 2);
      if (!isWallTile(maze, x, y + 1)) ctx.fillRect(px, py + TILE - 2, TILE, 2);
      if (!isWallTile(maze, x - 1, y)) ctx.fillRect(px, py, 2, TILE);
      if (!isWallTile(maze, x + 1, y)) ctx.fillRect(px + TILE - 2, py, 2, TILE);
    }
  }
}

function drawMast(ctx: Ctx, k: Skin, m: Mast) {
  ctx.fillStyle = k.text;
  ctx.fillRect(m.x - 1, m.y - 10, 2, 20);
  // La bandera sube por el poste con el progreso.
  const top = m.y + 2 - 12 * m.progress;
  ctx.fillStyle = m.raised ? k.line : k.flag;
  ctx.beginPath();
  ctx.moveTo(m.x + 1, top);
  ctx.lineTo(m.x + 13, top + 4);
  ctx.lineTo(m.x + 1, top + 8);
  if (k.style === "outline") {
    ctx.shadowColor = m.raised ? k.line : k.flag;
    ctx.shadowBlur = k.glow;
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  if (m.progress > 0 && !m.raised) {
    ctx.strokeStyle = k.flag;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(
      m.x,
      m.y,
      17,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * m.progress,
    );
    ctx.stroke();
  }
}

function drawGuard(ctx: Ctx, k: Skin, g: Guard, time: number) {
  const r = GUARD.size / 2;
  ctx.globalAlpha =
    g.state === "chase" && Math.floor(time * 10) % 2 === 1 ? 0.5 : 1;
  ctx.fillStyle = k.guard;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y - r);
  ctx.lineTo(g.x + r, g.y);
  ctx.lineTo(g.x, g.y + r);
  ctx.lineTo(g.x - r, g.y);
  ctx.closePath();
  if (k.style === "outline") {
    ctx.globalAlpha *= 0.35;
    ctx.fill();
    ctx.globalAlpha =
      g.state === "chase" && Math.floor(time * 10) % 2 === 1 ? 0.5 : 1;
    ctx.strokeStyle = k.guard;
    ctx.lineWidth = 2;
    ctx.shadowColor = k.guard;
    ctx.shadowBlur = k.glow;
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else ctx.fill();
  ctx.globalAlpha = 1;
  if (g.state === "confused") {
    ctx.fillStyle = k.text;
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", g.x, g.y);
    return;
  }
  ctx.fillStyle = k.text;
  ctx.beginPath();
  ctx.arc(g.x, g.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = k.bg;
  ctx.beginPath();
  ctx.arc(g.x + g.dir.x * 2, g.y + g.dir.y * 2, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawCar(ctx: Ctx, k: Skin, s: Scene) {
  if (s.invulnerable && Math.floor(s.time * 10) % 2 === 1) return;
  const half = CAR.size / 2;
  ctx.fillStyle = k.car;
  ctx.strokeStyle = k.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(
    s.car.x - half + 1,
    s.car.y - half + 1,
    CAR.size - 2,
    CAR.size - 2,
    6,
  );
  if (k.style === "outline") {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = k.car;
    ctx.shadowColor = k.car;
    ctx.shadowBlur = k.glow;
  } else ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Faros delanteros y parabrisas, según el rumbo.
  const { x: dx, y: dy } = s.facing;
  for (const side of [-6, 6]) {
    ctx.fillStyle = k.headlight;
    ctx.fillRect(
      s.car.x + dx * 8 - dy * side - 2,
      s.car.y + dy * 8 + dx * side - 2,
      4,
      4,
    );
  }
  ctx.fillStyle = k.wall;
  const w = dx !== 0 ? 4 : 12;
  const h = dx !== 0 ? 12 : 4;
  ctx.fillRect(s.car.x + dx * 2 - w / 2, s.car.y + dy * 2 - h / 2, w, h);
}

function drawExplosion(ctx: Ctx, k: Skin, s: Scene) {
  const t = s.deathTime / 0.5;
  if (t > 1) return;
  ctx.fillStyle = k.flag;
  ctx.globalAlpha = 1 - t;
  for (let n = 0; n < 8; n++) {
    const a = (n * Math.PI) / 4;
    ctx.fillRect(
      s.car.x + Math.cos(a) * 36 * t - 3,
      s.car.y + Math.sin(a) * 36 * t - 3,
      6,
      6,
    );
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx: Ctx, k: Skin, s: Scene) {
  ctx.fillStyle = k.bg;
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = k.line;
  ctx.fillRect(0, HUD_H - 2, W, 2);
  ctx.font = "bold 15px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const y = HUD_H / 2 - 1;
  const raised = s.masts.filter((m) => m.raised).length;
  ctx.fillStyle = k.text;
  ctx.fillText(`PUNTOS ${String(s.score).padStart(6, "0")}`, 14, y);
  ctx.fillText(`RONDA ${String(s.round).padStart(2, "0")}`, 172, y);
  ctx.fillText(`MÁSTILES ${raised}/${s.masts.length}`, 270, y);
  ctx.fillText(`PAR ${Math.floor(s.par)}`, 552, y);
  ctx.fillStyle = k.guard;
  ctx.fillText("♥ ".repeat(s.lives).trim(), 420, y);

  // Brújula: mástil pendiente más cercano en línea recta.
  let nearest: Mast | null = null;
  let best = Infinity;
  for (const m of s.masts) {
    const d = Math.hypot(m.x - s.car.x, m.y - s.car.y);
    if (!m.raised && d < best) {
      best = d;
      nearest = m;
    }
  }
  if (!nearest) return;
  ctx.fillStyle = k.flag;
  ctx.fillText(`D ${Math.round(best / TILE)}`, 722, y);
  ctx.save();
  ctx.translate(698, y);
  ctx.rotate(Math.atan2(nearest.y - s.car.y, nearest.x - s.car.x));
  ctx.beginPath();
  ctx.moveTo(13, 0);
  ctx.lineTo(-9, -8);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-9, 8);
  ctx.fill();
  ctx.restore();
}

// Nombre de la skin en la esquina inferior derecha del visor (el HUD va lleno).
function drawSkinName(ctx: Ctx, k: Skin) {
  ctx.font = "bold 12px monospace";
  const label = `SKIN: ${k.name.toUpperCase()}`;
  const w = ctx.measureText(label).width + 16;
  ctx.fillStyle = k.veilReady;
  ctx.fillRect(W - w - 8, H - 28, w, 20);
  ctx.fillStyle = k.text;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, W - w, H - 18);
}

function drawMessage(ctx: Ctx, k: Skin, title: string, detail: string) {
  ctx.fillStyle = k.veil;
  ctx.fillRect(0, HUD_H, W, VIEW_H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = k.line;
  ctx.font = "bold 34px monospace";
  ctx.fillText(title, W / 2, H / 2 - 10);
  ctx.fillStyle = k.text;
  ctx.font = "16px monospace";
  ctx.fillText(detail, W / 2, H / 2 + 32);
}

export function drawScene(ctx: Ctx, s: Scene, k: Skin) {
  const cam = camera(s.car.x, s.car.y);
  ctx.fillStyle = k.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HUD_H, W, VIEW_H);
  ctx.clip();
  ctx.translate(-cam.x, HUD_H - cam.y);
  drawMaze(ctx, k, s.maze, cam);
  for (const m of s.masts) drawMast(ctx, k, m);
  for (const g of s.guards) drawGuard(ctx, k, g, s.time);
  if (s.phase === "dead") drawExplosion(ctx, k, s);
  else if (s.phase !== "gameover") drawCar(ctx, k, s);
  ctx.restore();
  drawHud(ctx, k, s);

  drawSkinName(ctx, k);
  if (s.phase === "gameover")
    drawMessage(
      ctx,
      k,
      "Game over",
      `${s.score} puntos. Pulsa ESPACIO para reiniciar`,
    );
  else if (s.paused) drawMessage(ctx, k, "PAUSA", "Pulsa P para continuar");
  else if (s.phase === "clear")
    drawMessage(ctx, k, `Ronda superada +${s.clearBonus}`, "");
  else if (s.phase === "ready") {
    // Sin velo: se ve el laberinto y el coche antes de arrancar.
    ctx.fillStyle = k.veilReady;
    ctx.fillRect(W / 2 - 190, 430, 380, 44);
    ctx.fillStyle = k.text;
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Pulsa ESPACIO para arrancar", W / 2, 452);
  }
}
