import { ENEMY_BULLET, GATE, H, PLAY_TOP, SHIP, SHOT, W } from "./constants";
import type { Skin } from "./skins";
import type { Rect, Terrain } from "./terrain";

// Todas las entidades viven en coordenadas de pantalla (x del canvas). El
// terreno vive en coordenadas de mundo: x de mundo = dist + x de pantalla.

// Lo que una entidad necesita saber del mundo al actualizarse.
export type World = {
  scroll: number; // px/s del sector actual
  dist: number; // recorrido acumulado (px)
  sector: number;
  terrain: Terrain;
  shipX: number;
  shipY: number;
  addBullet: (b: EnemyBullet) => void;
};

// Rellena y traza el camino actual según el estilo de la skin: clásico con
// borde propio, retro plano sin borde y neon con trazo y relleno de alfa bajo.
function paint(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  fill: string,
  edge: string,
  outline: string = fill,
): void {
  if (skin.style === "flat") {
    ctx.fillStyle = fill;
    ctx.fill();
    return;
  }
  if (skin.style === "outline") {
    ctx.save();
    ctx.shadowColor = outline;
    ctx.shadowBlur = skin.glow;
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = outline;
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.stroke();
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// ---- Geometría ----

// Pasa un rectángulo de pantalla a mundo (para consultar el terreno).
export function toWorld(r: Rect, dist: number): Rect {
  return { x: r.x + dist, y: r.y, w: r.w, h: r.h };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

// Círculo contra rectángulo: punto del rectángulo más cercano al centro.
export function circleHitsRect(
  cx: number,
  cy: number,
  r: number,
  rect: Rect,
): boolean {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

// ---- Nave ----

export type Ship = {
  x: number; // centro
  y: number;
  invulnMs: number; // invulnerabilidad restante frente a enemigos y balas
  t: number; // segundos desde que existe (parpadeo de la llama)
};

export type Move = { dx: number; dy: number }; // -1, 0 o 1 en cada eje

export function createShip(y: number): Ship {
  return { x: SHIP.startX, y, invulnMs: 0, t: 0 };
}

export function updateShip(ship: Ship, dt: number, move: Move): void {
  const len = Math.hypot(move.dx, move.dy);
  if (len > 0) {
    // La diagonal se normaliza para no ir más rápido.
    ship.x += (move.dx / len) * SHIP.speed * dt;
    ship.y += (move.dy / len) * SHIP.speed * dt;
  }
  ship.x = clamp(ship.x, SHIP.minX, SHIP.maxX);
  ship.y = clamp(ship.y, PLAY_TOP + SHIP.h / 2, H - SHIP.h / 2);
  ship.invulnMs = Math.max(0, ship.invulnMs - dt * 1000);
  ship.t += dt;
}

// Caja de colisión (24×12) centrada en la nave, en coordenadas de pantalla.
export function shipRect(ship: Ship): Rect {
  return {
    x: ship.x - SHIP.hitW / 2,
    y: ship.y - SHIP.hitH / 2,
    w: SHIP.hitW,
    h: SHIP.hitH,
  };
}

export function drawShip(
  ctx: CanvasRenderingContext2D,
  ship: Ship,
  skin: Skin,
): void {
  // Parpadea a 8 Hz mientras es invulnerable.
  if (ship.invulnMs > 0 && Math.floor(ship.invulnMs / 62.5) % 2 === 1) return;
  const { x, y } = ship;
  const hw = SHIP.w / 2;
  const hh = SHIP.h / 2;
  // Llama de 6 px parpadeante.
  if (Math.floor(ship.t * 20) % 2 === 0) {
    ctx.fillStyle = skin.flame;
    ctx.beginPath();
    ctx.moveTo(x - hw, y - 4);
    ctx.lineTo(x - hw - 6, y);
    ctx.lineTo(x - hw, y + 4);
    ctx.closePath();
    ctx.fill();
  }
  // Triángulo alargado blanco con borde cian.
  ctx.beginPath();
  ctx.moveTo(x + hw, y);
  ctx.lineTo(x - hw, y - hh);
  ctx.lineTo(x - hw + 8, y);
  ctx.lineTo(x - hw, y + hh);
  ctx.closePath();
  ctx.lineWidth = 2;
  paint(ctx, skin, skin.ship, skin.shipEdge, skin.shipEdge);
}

// ---- Disparos de la nave ----

export type Shot = { x: number; y: number; dead: boolean };

export function createShot(ship: Ship): Shot {
  return { x: ship.x + SHIP.w / 2, y: ship.y, dead: false };
}

export function shotRect(s: Shot): Rect {
  return { x: s.x - SHOT.w / 2, y: s.y - SHOT.h / 2, w: SHOT.w, h: SHOT.h };
}

export function updateShot(s: Shot, dt: number, w: World): void {
  s.x += SHOT.speed * dt;
  if (s.x - SHOT.w / 2 > W) {
    s.dead = true;
    return;
  }
  if (w.terrain.rectHitsTerrain(toWorld(shotRect(s), w.dist))) s.dead = true;
}

export function drawShot(
  ctx: CanvasRenderingContext2D,
  s: Shot,
  skin: Skin,
): void {
  ctx.save();
  ctx.fillStyle = skin.shot;
  ctx.shadowColor = skin.shot;
  ctx.shadowBlur = skin.glow;
  ctx.fillRect(s.x - SHOT.w / 2, s.y - SHOT.h / 2, SHOT.w, SHOT.h);
  ctx.restore();
}

// ---- Balas enemigas ----

export type EnemyBullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dead: boolean;
};

export function bulletSpeed(sector: number): number {
  return Math.min(
    ENEMY_BULLET.speedMax,
    ENEMY_BULLET.speed + ENEMY_BULLET.speedDelta * (sector - 1),
  );
}

// Bala que sale de (x, y) hacia (tx, ty).
export function createAimedBullet(
  x: number,
  y: number,
  tx: number,
  ty: number,
  sector: number,
): EnemyBullet {
  const angle = Math.atan2(ty - y, tx - x);
  const speed = bulletSpeed(sector);
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    dead: false,
  };
}

export function updateBullet(b: EnemyBullet, dt: number, w: World): void {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  const r = ENEMY_BULLET.r;
  if (b.x < -r || b.x > W + r || b.y < PLAY_TOP - r || b.y > H + r) {
    b.dead = true;
    return;
  }
  // Desaparece al tocar el terreno.
  const box = { x: b.x - r, y: b.y - r, w: r * 2, h: r * 2 };
  if (w.terrain.rectHitsTerrain(toWorld(box, w.dist))) b.dead = true;
}

export function drawBullet(
  ctx: CanvasRenderingContext2D,
  b: EnemyBullet,
  skin: Skin,
): void {
  ctx.beginPath();
  ctx.arc(b.x, b.y, ENEMY_BULLET.r, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  paint(ctx, skin, skin.bullet, skin.bulletEdge);
}

// ---- Enemigos ----

export type EnemyKind = "dart" | "swarm" | "turret" | "buoy";

export const ENEMY_DEFS: Record<
  EnemyKind,
  { r: number; hp: number; points: number; fromSector: number }
> = {
  dart: { r: 12, hp: 1, points: 100, fromSector: 1 },
  swarm: { r: 10, hp: 1, points: 100, fromSector: 1 },
  turret: { r: 14, hp: 2, points: 150, fromSector: 2 },
  buoy: { r: 16, hp: 3, points: 200, fromSector: 3 },
};

const DART_AMP = 50;
const DART_PERIOD = 1.6;
const SWARM_AMP = 80;
const SWARM_PERIOD = 2.0;
const DART_EXTRA_SPEED = 100; // vx = -(scroll + 100)
const BUOY_SLOWDOWN = 40; // vx = -(scroll - 40)
const BUOY_VY = 60;
const TURRET_FIRST_SHOT = 1.0; // s desde que entra en pantalla
const TURRET_PERIOD = 2.0;
const TURRET_PERIOD_FAST = 1.5; // desde el sector 4

export type Enemy = {
  kind: EnemyKind;
  x: number;
  y: number;
  y0: number; // centro de la onda (Dardo, Enjambre) o posición inicial (Boya)
  r: number;
  hp: number;
  points: number;
  t: number; // segundos desde que apareció
  phase: number; // desfase de la onda (s)
  group: number; // id del Enjambre; 0 si no pertenece a ninguno
  anchor: "ceil" | "floor"; // Torreta: dónde está anclada
  vy: number; // Boya: px/s con signo
  shootIn: number | null; // Torreta: s hasta el siguiente disparo; null = aún fuera de pantalla
  aim: number; // Torreta: ángulo del cañón hacia la nave
  dead: boolean;
};

export type EnemyOpts = {
  phase?: number;
  group?: number;
  anchor?: "ceil" | "floor";
  vy?: number;
};

export function createEnemy(
  kind: EnemyKind,
  x: number,
  y0: number,
  opts: EnemyOpts = {},
): Enemy {
  const def = ENEMY_DEFS[kind];
  return {
    kind,
    x,
    y: y0,
    y0,
    r: def.r,
    hp: def.hp,
    points: def.points,
    t: 0,
    phase: opts.phase ?? 0,
    group: opts.group ?? 0,
    anchor: opts.anchor ?? "floor",
    vy: opts.vy ?? BUOY_VY,
    shootIn: null,
    aim: Math.PI,
    dead: false,
  };
}

export function updateEnemy(e: Enemy, dt: number, w: World): void {
  e.t += dt;
  switch (e.kind) {
    case "dart":
    case "swarm": {
      const swarm = e.kind === "swarm";
      const amp = swarm ? SWARM_AMP : DART_AMP;
      const period = swarm ? SWARM_PERIOD : DART_PERIOD;
      e.x -= (w.scroll + DART_EXTRA_SPEED) * dt;
      e.y = clamp(
        e.y0 + amp * Math.sin((2 * Math.PI * (e.t + e.phase)) / period),
        PLAY_TOP + e.r,
        H - e.r,
      );
      break;
    }
    case "turret": {
      e.x -= w.scroll * dt;
      const wx = w.dist + e.x;
      e.y = e.anchor === "ceil" ? w.terrain.ceilAt(wx) : w.terrain.floorAt(wx);
      e.aim = Math.atan2(w.shipY - e.y, w.shipX - e.x);
      if (e.shootIn === null && e.x <= W) e.shootIn = TURRET_FIRST_SHOT;
      if (e.shootIn !== null) {
        e.shootIn -= dt;
        if (e.shootIn <= 0) {
          // La bala sale de la punta del cañón.
          const muzzle = e.r + ENEMY_BULLET.r;
          w.addBullet(
            createAimedBullet(
              e.x + Math.cos(e.aim) * muzzle,
              e.y + Math.sin(e.aim) * muzzle,
              w.shipX,
              w.shipY,
              w.sector,
            ),
          );
          e.shootIn += w.sector >= 4 ? TURRET_PERIOD_FAST : TURRET_PERIOD;
        }
      }
      break;
    }
    case "buoy": {
      e.x -= (w.scroll - BUOY_SLOWDOWN) * dt;
      e.y += e.vy * dt;
      const wx = w.dist + e.x;
      const lo = w.terrain.ceilAt(wx) + e.r;
      const hi = w.terrain.floorAt(wx) - e.r;
      // Rebota entre techo y suelo de su columna.
      if (e.y < lo) {
        e.y = lo;
        e.vy = Math.abs(e.vy);
      } else if (e.y > hi) {
        e.y = hi;
        e.vy = -Math.abs(e.vy);
      }
      break;
    }
  }
  if (e.x + e.r < 0) e.dead = true;
}

export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  e: Enemy,
  skin: Skin,
): void {
  const { x, y, r } = e;
  ctx.lineWidth = 2;
  switch (e.kind) {
    case "dart": {
      // Rombo magenta.
      ctx.beginPath();
      ctx.moveTo(x - r, y);
      ctx.lineTo(x, y - r * 0.7);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r * 0.7);
      ctx.closePath();
      paint(ctx, skin, skin.dart, skin.enemyEdge);
      break;
    }
    case "swarm": {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      paint(ctx, skin, skin.swarm, skin.enemyEdge);
      break;
    }
    case "turret": {
      // Cañón hacia la nave y semicírculo hacia el interior de la caverna.
      ctx.save();
      if (skin.style === "outline") {
        ctx.shadowColor = skin.turret;
        ctx.shadowBlur = skin.glow;
      }
      ctx.strokeStyle = skin.turret;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(e.aim) * (r + 6), y + Math.sin(e.aim) * (r + 6));
      ctx.stroke();
      ctx.beginPath();
      if (e.anchor === "ceil") ctx.arc(x, y, r, 0, Math.PI);
      else ctx.arc(x, y, r, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.lineWidth = 2;
      ctx.restore();
      paint(ctx, skin, skin.turret, skin.enemyEdge);
      break;
    }
    case "buoy": {
      // Hexágono verde con su vida restante en puntos.
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      paint(ctx, skin, skin.buoy, skin.enemyEdge);
      ctx.fillStyle = skin.buoyPip;
      for (let i = 0; i < e.hp; i++) {
        ctx.beginPath();
        ctx.arc(x + (i - (e.hp - 1) / 2) * 7, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
}

// ---- Puerta de sector ----

export type Gate = {
  x: number; // borde izquierdo
  hp: number;
  hpMax: number;
  sector: number; // sector en el que apareció (puntos = 500 × sector)
  dead: boolean;
};

// Impactos para destruirla: min(14, 4 + 2 × sector).
export function gateHp(sector: number): number {
  return Math.min(GATE.hpMax, GATE.hpBase + GATE.hpPerSector * sector);
}

export function createGate(sector: number): Gate {
  const hp = gateHp(sector);
  return { x: W + 20, hp, hpMax: hp, sector, dead: false };
}

export function updateGate(g: Gate, dt: number, w: World): void {
  g.x -= w.scroll * dt;
}

// Ocupa todo el alto de la zona de juego: lo que no es hueco ya es terreno,
// que también mata.
export function gateRect(g: Gate): Rect {
  return { x: g.x, y: PLAY_TOP, w: GATE.w, h: H - PLAY_TOP };
}

export function drawGate(
  ctx: CanvasRenderingContext2D,
  g: Gate,
  w: Pick<World, "terrain" | "dist">,
  skin: Skin,
): void {
  // Solo el hueco de sus dos columnas; el terreno se dibuja aparte.
  const wx = w.dist + g.x;
  const top = Math.max(w.terrain.ceilAt(wx), w.terrain.ceilAt(wx + GATE.w - 1));
  const bottom = Math.min(
    w.terrain.floorAt(wx),
    w.terrain.floorAt(wx + GATE.w - 1),
  );
  ctx.save();
  // El brillo baja con la vida restante.
  ctx.globalAlpha =
    (0.4 + 0.6 * (g.hp / g.hpMax)) * (skin.style === "outline" ? 0.45 : 1);
  ctx.beginPath();
  ctx.rect(g.x, top, GATE.w, bottom - top);
  ctx.clip();
  const stripe = 16;
  for (let y = top - stripe; y < bottom; y += stripe) {
    const odd = Math.round((y - top) / stripe) % 2 !== 0;
    ctx.fillStyle = odd ? skin.gateB : skin.gateA;
    ctx.beginPath();
    ctx.moveTo(g.x, y + stripe);
    ctx.lineTo(g.x + GATE.w, y);
    ctx.lineTo(g.x + GATE.w, y + stripe);
    ctx.lineTo(g.x, y + stripe * 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = skin.gateEdge;
  if (skin.style === "outline") {
    ctx.shadowColor = skin.gateB;
    ctx.shadowBlur = skin.glow;
  }
  ctx.strokeRect(g.x, top, GATE.w, bottom - top);
  ctx.restore();
}
