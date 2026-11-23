// Cada skin define la paleta semántica de Banderas y su estilo de dibujo.
// Clásico es el aspecto original (paleta de COLORS) y la skin por defecto.
import { COLORS } from "./constants";

export type SkinId = "clasico" | "retro" | "neon";

export type Skin = {
  id: SkinId;
  name: string;
  bg: string;
  floor: string;
  wall: string;
  line: string; // filo de muros, bandera izada, marco del coche y título
  car: string;
  headlight: string;
  guard: string;
  flag: string;
  text: string;
  veil: string; // velo de pausa / game over
  veilReady: string; // caja de "Pulsa ESPACIO"
  // glow: relleno plano (original); flat: relleno plano sin glow;
  // outline: contorno saturado, relleno con alfa bajo y glow en las entidades.
  style: "glow" | "flat" | "outline";
  glow: number; // shadowBlur de las entidades principales (0 = sin glow)
};

export const SKIN_KEY = "banderas.skin";

export const SKINS: Record<SkinId, Skin> = {
  clasico: {
    id: "clasico",
    name: "Clásico",
    bg: COLORS.bg,
    floor: COLORS.floor,
    wall: COLORS.wall,
    line: COLORS.line,
    car: COLORS.car,
    headlight: "#b8860b",
    guard: COLORS.guard,
    flag: COLORS.flag,
    text: COLORS.text,
    veil: "rgba(5, 7, 13, 0.78)",
    veilReady: "rgba(5, 7, 13, 0.88)",
    style: "glow",
    glow: 0,
  },
  retro: {
    id: "retro",
    name: "Retro",
    bg: "#080d06",
    floor: "#111a0c",
    wall: "#2c4519",
    line: "#9fd43a",
    car: "#e9e2b0",
    headlight: "#7a5a10",
    guard: "#ff9a1f",
    flag: "#e8b923",
    text: "#c9e8a0",
    veil: "rgba(8, 13, 6, 0.8)",
    veilReady: "rgba(8, 13, 6, 0.9)",
    style: "flat",
    glow: 0,
  },
  neon: {
    id: "neon",
    name: "Neón",
    bg: "#04040c",
    floor: "#080816",
    wall: "#12204a",
    line: "#00f5ff",
    car: "#ffffff",
    headlight: "#f5ff00",
    guard: "#ff2e88",
    flag: "#f5ff00",
    text: "#e6fbff",
    veil: "rgba(4, 4, 12, 0.78)",
    veilReady: "rgba(4, 4, 12, 0.88)",
    style: "outline",
    glow: 14,
  },
};

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
