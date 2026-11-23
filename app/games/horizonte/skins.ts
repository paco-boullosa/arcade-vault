// Cada skin define la paleta semántica de Horizonte y su estilo de dibujo.
// Clásico es el aspecto original (neón cian/magenta/amarillo sobre negro).
export type SkinId = "clasico" | "retro" | "neon";

export type Skin = {
  id: SkinId;
  name: string;
  bg: string;
  star: string;
  terrainFill: string;
  terrainEdge: string;
  hudBg: string;
  hudLine: string;
  hudTrack: string; // fondo de la barra de la puerta
  ink: string; // texto principal
  inkDim: string; // texto secundario (nombre de la skin)
  ship: string;
  shipEdge: string;
  flame: string;
  shot: string;
  bullet: string;
  bulletEdge: string;
  dart: string;
  swarm: string;
  turret: string;
  buoy: string;
  buoyPip: string; // puntos de vida de la Boya
  enemyEdge: string; // borde de los enemigos (solo clásico)
  gateA: string;
  gateB: string;
  gateEdge: string;
  gateBar: string;
  lives: string; // iconos de vidas
  burst: string[]; // partículas de la explosión
  burstRing: string;
  glowColor: string; // color del resplandor de los textos grandes
  // flat: relleno plano sin borde; outline: trazo + relleno con alfa bajo.
  style: "solid" | "flat" | "outline";
  glow: number; // shadowBlur de las entidades principales (0 = sin glow)
};

export const SKIN_KEY = "horizonte.skin";

export const SKINS: Record<SkinId, Skin> = {
  clasico: {
    id: "clasico",
    name: "Clásico",
    bg: "#000000",
    star: "#ffffff",
    terrainFill: "#032a33",
    terrainEdge: "#00e5ff",
    hudBg: "#000000",
    hudLine: "rgba(0, 229, 255, 0.35)",
    hudTrack: "rgba(230, 233, 255, 0.12)",
    ink: "#ffffff",
    inkDim: "#e6e9ff",
    ship: "#ffffff",
    shipEdge: "#00e5ff",
    flame: "#ff8a00",
    shot: "#00e5ff",
    bullet: "#ff6b9d",
    bulletEdge: "#ffffff",
    dart: "#ff2bd6",
    swarm: "#ffe600",
    turret: "#ff8a00",
    buoy: "#39ff14",
    buoyPip: "#04210a",
    enemyEdge: "#ffffff",
    gateA: "#ff2bd6",
    gateB: "#00e5ff",
    gateEdge: "#ffffff",
    gateBar: "#ff2bd6",
    lives: "#00e5ff",
    burst: ["#ffffff", "#ffe600", "#ff8a00"],
    burstRing: "#00e5ff",
    glowColor: "#00e5ff",
    style: "solid",
    glow: 0,
  },
  retro: {
    id: "retro",
    name: "Retro",
    bg: "#050b06",
    star: "#7dff8f",
    terrainFill: "#0c2a12",
    terrainEdge: "#5fd873",
    hudBg: "#050b06",
    hudLine: "rgba(125, 255, 143, 0.35)",
    hudTrack: "rgba(125, 255, 143, 0.14)",
    ink: "#7dff8f",
    inkDim: "#5fd873",
    ship: "#d8ff8a",
    shipEdge: "#d8ff8a",
    flame: "#ffb347",
    shot: "#d8ff8a",
    bullet: "#ffb347",
    bulletEdge: "#ffb347",
    dart: "#ffb347",
    swarm: "#d8ff8a",
    turret: "#e0a050",
    buoy: "#5fd873",
    buoyPip: "#050b06",
    enemyEdge: "#050b06",
    gateA: "#5fd873",
    gateB: "#ffb347",
    gateEdge: "#d8ff8a",
    gateBar: "#ffb347",
    lives: "#d8ff8a",
    burst: ["#d8ff8a", "#ffb347", "#5fd873"],
    burstRing: "#d8ff8a",
    glowColor: "#5fd873",
    style: "flat",
    glow: 0,
  },
  neon: {
    id: "neon",
    name: "Neon",
    bg: "#06061a",
    star: "#b8b8e0",
    terrainFill: "#0a0a2e",
    terrainEdge: "#ff2bd6",
    hudBg: "#06061a",
    hudLine: "rgba(255, 43, 214, 0.45)",
    hudTrack: "rgba(184, 184, 224, 0.16)",
    ink: "#ffffff",
    inkDim: "#b8b8e0",
    ship: "#b8fbff",
    shipEdge: "#00f0ff",
    flame: "#ff8a00",
    shot: "#00f0ff",
    bullet: "#ff4d6d",
    bulletEdge: "#ff4d6d",
    dart: "#ff2bd6",
    swarm: "#ffee00",
    turret: "#ff8a00",
    buoy: "#39ff14",
    buoyPip: "#39ff14",
    enemyEdge: "#ffffff",
    gateA: "#00f0ff",
    gateB: "#ff2bd6",
    gateEdge: "#ffffff",
    gateBar: "#00f0ff",
    lives: "#00f0ff",
    burst: ["#ffffff", "#ffee00", "#ff2bd6"],
    burstRing: "#00f0ff",
    glowColor: "#00f0ff",
    style: "outline",
    glow: 10,
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
