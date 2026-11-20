// Cada skin define la paleta semántica del juego y su estilo de trazo.
// Clásico es el aspecto original (vectorial blanco sobre negro).
export type SkinId = "clasico" | "retro" | "neon";

export type Skin = {
  id: SkinId;
  name: string;
  bg: string;
  ship: string;
  flame: string;
  asteroid: string;
  asteroidFill: string | null; // relleno con alfa bajo (null = sin relleno)
  bullet: string;
  particle: string; // "r,g,b": el alfa lo pone la partícula al desvanecerse
  powerUp: string;
  text: string;
  textDim: string;
  triple: string; // texto del disparo triple
  shield: string; // "r,g,b" del escudo y su texto
  glow: number; // shadowBlur de las entidades principales (0 = sin glow)
};

export const SKIN_KEY = "asteroids.skin";

export const SKINS: Record<SkinId, Skin> = {
  clasico: {
    id: "clasico",
    name: "Clásico",
    bg: "#000",
    ship: "#fff",
    flame: "rgba(255, 130, 0, 0.85)",
    asteroid: "#fff",
    asteroidFill: null,
    bullet: "#fff",
    particle: "255,255,255",
    powerUp: "#0ff",
    text: "#fff",
    textDim: "rgba(255,255,255,0.65)",
    triple: "#0ff",
    shield: "80,180,255",
    glow: 0,
  },
  retro: {
    id: "retro",
    name: "Retro",
    bg: "#050b06",
    ship: "#7dff8f",
    flame: "#d8ff8a",
    asteroid: "#5fd873",
    asteroidFill: null,
    bullet: "#d8ff8a",
    particle: "125,255,143",
    powerUp: "#d8ff8a",
    text: "#7dff8f",
    textDim: "#5fd873",
    triple: "#d8ff8a",
    shield: "170,255,190",
    glow: 0,
  },
  neon: {
    id: "neon",
    name: "Neon",
    bg: "#06061a",
    ship: "#00f0ff",
    flame: "#ff9100",
    asteroid: "#ff2bd6",
    asteroidFill: "rgba(255,43,214,0.14)",
    bullet: "#ffee00",
    particle: "255,120,230",
    powerUp: "#00ff6a",
    text: "#ffffff",
    textDim: "#b8b8e0",
    triple: "#00ff6a",
    shield: "90,160,255",
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

// Activa el glow del neon para lo que se dibuje a continuación (no-op sin glow).
export function glowOn(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  color: string,
): void {
  if (skin.glow <= 0) return;
  ctx.shadowColor = color;
  ctx.shadowBlur = skin.glow;
}

export function glowOff(ctx: CanvasRenderingContext2D, skin: Skin): void {
  if (skin.glow <= 0) return;
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}
