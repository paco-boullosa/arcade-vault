import type { BlockColor } from "./constants";

// Cada skin define la paleta semántica del juego y su estilo de dibujo.
// Clásico es el aspecto original: sprites de la hoja sobre negro. Retro y Neon
// se dibujan con formas del canvas (sin assets nuevos).
export type SkinId = "clasico" | "retro" | "neon";

export type Skin = {
  id: SkinId;
  name: string;
  bg: string;
  sprites: boolean; // true: sprites de la hoja; false: formas del canvas
  blocks: Record<BlockColor, string>;
  blockFill: number; // alfa del relleno del bloque (1 = plano)
  paddle: string;
  ball: string;
  text: string;
  textDim: string;
  glow: number; // shadowBlur de pala y bola (0 = sin glow)
};

export const SKIN_KEY = "arkanoid.skin";

export const SKINS: Record<SkinId, Skin> = {
  clasico: {
    id: "clasico",
    name: "Clásico",
    bg: "#000",
    sprites: true,
    // Solo se usan para las explosiones y como referencia de contraste
    blocks: {
      red: "#e53935",
      yellow: "#fdd835",
      cyan: "#26c6da",
      magenta: "#ab47bc",
      hotpink: "#ec407a",
      green: "#66bb6a",
      gray: "#9e9e9e",
    },
    blockFill: 1,
    paddle: "#fff",
    ball: "#fff",
    text: "#fff",
    textDim: "rgba(255,255,255,0.65)",
    glow: 0,
  },
  retro: {
    id: "retro",
    name: "Retro",
    bg: "#050b06",
    sprites: false,
    blocks: {
      red: "#d8ff8a",
      yellow: "#7dff8f",
      cyan: "#5fd873",
      magenta: "#3fae55",
      hotpink: "#a6e8b0",
      green: "#8fd9a0",
      gray: "#9bb59f",
    },
    blockFill: 1,
    paddle: "#7dff8f",
    ball: "#d8ff8a",
    text: "#7dff8f",
    textDim: "#5fd873",
    glow: 0,
  },
  neon: {
    id: "neon",
    name: "Neon",
    bg: "#06061a",
    sprites: false,
    blocks: {
      red: "#ff1744",
      yellow: "#ffee00",
      cyan: "#00e5ff",
      magenta: "#d500f9",
      hotpink: "#ff2bd6",
      green: "#00ff6a",
      gray: "#b8b8e0",
    },
    blockFill: 0.16,
    paddle: "#00f0ff",
    ball: "#ffffff",
    text: "#ffffff",
    textDim: "#b8b8e0",
    glow: 10,
  },
};

// Orden en el que `S` recorre las skins.
export const SKIN_ORDER: SkinId[] = ["clasico", "retro", "neon"];

export function nextSkin(current: SkinId): SkinId {
  return SKIN_ORDER[(SKIN_ORDER.indexOf(current) + 1) % SKIN_ORDER.length];
}

function isSkinId(v: unknown): v is SkinId {
  return SKIN_ORDER.some((id) => id === v);
}

// Lee la skin guardada; Clásico si no hay nada o `localStorage` no está disponible.
export function loadSkin(): Skin {
  try {
    const saved = localStorage.getItem(SKIN_KEY);
    if (isSkinId(saved)) return SKINS[saved];
  } catch {
    /* localStorage bloqueado: skin por defecto */
  }
  return SKINS.clasico;
}

export function saveSkin(id: SkinId): void {
  try {
    localStorage.setItem(SKIN_KEY, id);
  } catch {
    /* localStorage bloqueado: la elección solo dura la sesión */
  }
}

function glowOn(ctx: CanvasRenderingContext2D, skin: Skin, color: string) {
  if (skin.glow <= 0) return;
  ctx.shadowColor = color;
  ctx.shadowBlur = skin.glow;
}

function glowOff(ctx: CanvasRenderingContext2D, skin: Skin) {
  if (skin.glow <= 0) return;
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

// Bloque con formas del canvas (retro: plano; neon: trazo + relleno con alfa bajo)
export function drawShapeBlock(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  color: BlockColor,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const c = skin.blocks[color];
  if (skin.blockFill >= 1) {
    ctx.fillStyle = c;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x + 1, y + h - 5, w - 2, 4);
    return;
  }
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * skin.blockFill;
  ctx.fillStyle = c;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.globalAlpha = a;
  ctx.strokeStyle = c;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
}

// Explosión: destello que se encoge y se desvanece (t de 0 a 1)
export function drawShapeExplosion(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  color: BlockColor,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
) {
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * (1 - t);
  ctx.fillStyle = skin.blocks[color];
  const g = t * 8;
  ctx.fillRect(x - 4 + g, y - 4 + g, w + 8 - g * 2, h + 8 - g * 2);
  ctx.globalAlpha = a;
}

export function drawShapePaddle(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  glowOn(ctx, skin, skin.paddle);
  if (skin.blockFill >= 1) {
    ctx.fillStyle = skin.paddle;
    ctx.fillRect(x, y, w, h);
  } else {
    ctx.fillStyle = "rgba(0,240,255,0.16)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = skin.paddle;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }
  glowOff(ctx, skin);
}

export function drawShapeBall(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  x: number,
  y: number,
  size: number,
) {
  glowOn(ctx, skin, skin.id === "neon" ? "#00f0ff" : skin.ball);
  ctx.fillStyle = skin.ball;
  if (skin.id === "retro") {
    ctx.fillRect(x, y, size, size);
  } else {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  glowOff(ctx, skin);
}
