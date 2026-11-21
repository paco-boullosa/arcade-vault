// Cada skin define la paleta semántica de Frogger y su estilo de dibujo.
// Clásico es el aspecto original (paleta neon de la plataforma con resplandor).
export type SkinId = "clasico" | "retro" | "neon";

export type Skin = {
  id: SkinId;
  name: string;
  bg: string;
  goal: string;
  goalEdge: string;
  water: string;
  waterWave: string;
  median: string;
  medianEdge: string;
  road: string;
  roadLine: string;
  start: string;
  ink: string; // texto
  inkDim: string; // texto secundario (nombre de la skin)
  frog: string;
  dead: string;
  cyan: string;
  yellow: string;
  magenta: string;
  log: string;
  logLight: string;
  shell: string;
  shellLight: string;
  bus: string;
  truck: string;
  // glow: relleno + resplandor; flat: relleno plano sin glow;
  // outline: contorno saturado, relleno con alfa bajo y glow solo en rana y vehículos.
  style: "glow" | "flat" | "outline";
  glow: number; // shadowBlur de las entidades principales (0 = sin glow)
};

export const SKIN_KEY = "frogger.skin";

export const SKINS: Record<SkinId, Skin> = {
  clasico: {
    id: "clasico",
    name: "Clásico",
    bg: "#0a0a0f",
    goal: "#0b2a18",
    goalEdge: "#00ff88",
    water: "#07173a",
    waterWave: "rgba(0, 245, 255, 0.12)",
    median: "#1a1033",
    medianEdge: "#b266ff",
    road: "#1d1d26",
    roadLine: "rgba(230, 233, 255, 0.28)",
    start: "#101018",
    ink: "#e6e9ff",
    inkDim: "#e6e9ff",
    frog: "#00ff88",
    dead: "#ff006e",
    cyan: "#00f5ff",
    yellow: "#f5ff00",
    magenta: "#ff006e",
    log: "#6b3f1d",
    logLight: "#8f5a2c",
    shell: "#1fae6b",
    shellLight: "#7dffc0",
    bus: "#ff8a00",
    truck: "#b266ff",
    style: "glow",
    glow: 10,
  },
  retro: {
    id: "retro",
    name: "Retro",
    bg: "#050b06",
    goal: "#0d1f10",
    goalEdge: "#7dff8f",
    water: "#0a1a14",
    waterWave: "rgba(125, 255, 143, 0.14)",
    median: "#101a10",
    medianEdge: "#5fd873",
    road: "#121712",
    roadLine: "rgba(216, 255, 138, 0.3)",
    start: "#0a120b",
    ink: "#7dff8f",
    inkDim: "#5fd873",
    frog: "#d8ff8a",
    dead: "#ffb347",
    cyan: "#5fd8c0",
    yellow: "#d8ff8a",
    magenta: "#e8845a",
    log: "#8a6a2c",
    logLight: "#c9a24a",
    shell: "#3f9f5a",
    shellLight: "#a8f0b0",
    bus: "#ffb347",
    truck: "#5fd873",
    style: "flat",
    glow: 0,
  },
  neon: {
    id: "neon",
    name: "Neon",
    bg: "#06061a",
    goal: "#0a1630",
    goalEdge: "#ff2bd6",
    water: "#06103a",
    waterWave: "rgba(0, 240, 255, 0.18)",
    median: "#14082e",
    medianEdge: "#ff2bd6",
    road: "#0d0d26",
    roadLine: "rgba(0, 240, 255, 0.3)",
    start: "#0a0a22",
    ink: "#ffffff",
    inkDim: "#b8b8e0",
    frog: "#39ff88",
    dead: "#ff4d6d",
    cyan: "#00f0ff",
    yellow: "#ffee00",
    magenta: "#ff2bd6",
    log: "#ff9a3c",
    logLight: "#ffc27a",
    shell: "#39ff88",
    shellLight: "#b8ffd6",
    bus: "#ff9a3c",
    truck: "#b36bff",
    style: "outline",
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
