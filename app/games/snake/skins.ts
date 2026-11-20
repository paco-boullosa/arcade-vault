// Cada skin define la paleta semántica de Snake y su estilo de dibujo.
// Clásico es el aspecto original (serpiente con resplandor verde y frutas sprite).
export type SkinId = "clasico" | "retro" | "neon";

export type Skin = {
  id: SkinId;
  name: string;
  bg: string;
  grid: string;
  body: string; // cuerpo de la serpiente
  head: string;
  dead: string; // serpiente muerta
  bodyFill: string; // relleno con alfa bajo (solo neon)
  fruit: string; // color de la fruta cuando no es sprite
  ink: string; // texto
  inkDim: string; // texto secundario
  bodyStyle: "glow-line" | "blocks" | "outline";
  fruitStyle: "sprite" | "square" | "ring";
  glow: number; // shadowBlur de las entidades principales (0 = sin glow)
};

export const SKIN_KEY = "snake.skin";

export const SKINS: Record<SkinId, Skin> = {
  clasico: {
    id: "clasico",
    name: "Clásico",
    bg: "#0a0a0f",
    grid: "rgba(0, 245, 255, 0.07)",
    body: "#00ff88",
    head: "#7dffc0",
    dead: "#ff006e",
    bodyFill: "rgba(0, 255, 136, 0.2)",
    fruit: "#ff006e",
    ink: "#e6e9ff",
    inkDim: "#e6e9ff",
    bodyStyle: "glow-line",
    fruitStyle: "sprite",
    glow: 16,
  },
  retro: {
    id: "retro",
    name: "Retro",
    bg: "#050b06",
    grid: "rgba(125, 255, 143, 0.08)",
    body: "#5fd873",
    head: "#d8ff8a",
    dead: "#ffb347",
    bodyFill: "rgba(95, 216, 115, 0.2)",
    fruit: "#d8ff8a",
    ink: "#7dff8f",
    inkDim: "#5fd873",
    bodyStyle: "blocks",
    fruitStyle: "square",
    glow: 0,
  },
  neon: {
    id: "neon",
    name: "Neon",
    bg: "#06061a",
    grid: "rgba(255, 43, 214, 0.12)",
    body: "#00f0ff",
    head: "#b8fbff",
    dead: "#ff4d6d",
    bodyFill: "rgba(0, 240, 255, 0.18)",
    fruit: "#ffee00",
    ink: "#ffffff",
    inkDim: "#b8b8e0",
    bodyStyle: "outline",
    fruitStyle: "ring",
    glow: 12,
  },
};

// Orden en el que `K` recorre las skins.
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
