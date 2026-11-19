// Cada skin define su paleta (índices 1–9, como el tablero), el color de la
// rejilla y su función de dibujo de bloque.
export type SkinId = "retro" | "neon" | "pastel" | "pixel";

export type Skin = {
  id: SkinId;
  name: string;
  colors: (string | null)[];
  grid: string;
  draw: (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    size: number,
  ) => void;
};

export const SKIN_KEY = "tetris.skin";

function roundedRectPath(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export const SKINS: Record<SkinId, Skin> = {
  retro: {
    id: "retro",
    name: "Retro",
    colors: [
      null,
      "#4dd0e1", // I
      "#ffd54f", // O
      "#ba68c8", // T
      "#81c784", // S
      "#e57373", // Z
      "#7986cb", // J
      "#ffb74d", // L
      "#5a5a6e", // gris
      "#ffffff", // comodín
    ],
    grid: "#22222e",
    draw(c, x, y, color, size) {
      c.fillStyle = color;
      c.fillRect(x + 1, y + 1, size - 2, size - 2);
      c.fillStyle = "rgba(255,255,255,0.12)";
      c.fillRect(x + 1, y + 1, size - 2, 4);
    },
  },
  neon: {
    id: "neon",
    name: "Neon",
    colors: [
      null,
      "#00e5ff",
      "#ffee00",
      "#d500f9",
      "#00ff6a",
      "#ff1744",
      "#4d7cff",
      "#ff9100",
      "#8a8aa0",
      "#ffffff",
    ],
    grid: "#10151c",
    draw(c, x, y, color, size) {
      const a = c.globalAlpha;
      c.shadowColor = color;
      c.shadowBlur = size * 0.6;
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.strokeRect(x + 3, y + 3, size - 6, size - 6);
      c.shadowBlur = 0;
      c.globalAlpha = a * 0.28;
      c.fillStyle = color;
      c.fillRect(x + 3, y + 3, size - 6, size - 6);
      c.globalAlpha = a;
      c.shadowColor = "transparent";
    },
  },
  pastel: {
    id: "pastel",
    name: "Pastel",
    colors: [
      null,
      "#a8e6ef",
      "#fff1b0",
      "#d9b8f0",
      "#b8e8c4",
      "#f5b7b7",
      "#b9c1f0",
      "#fcd5a5",
      "#c9c9d6",
      "#ffffff",
    ],
    grid: "#2a2a38",
    draw(c, x, y, color, size) {
      const r = size * 0.3;
      c.fillStyle = color;
      roundedRectPath(c, x + 2, y + 2, size - 4, size - 4, r);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.35)";
      roundedRectPath(c, x + 5, y + 5, size - 10, size * 0.22, size * 0.1);
      c.fill();
    },
  },
  pixel: {
    id: "pixel",
    name: "Pixel art",
    colors: [
      null,
      "#29b6f6",
      "#fbc02d",
      "#ab47bc",
      "#66bb6a",
      "#ef5350",
      "#5c6bc0",
      "#ff9800",
      "#6b6b7f",
      "#ffffff",
    ],
    grid: "#1c1c28",
    draw(c, x, y, color, size) {
      const px = Math.max(2, Math.floor(size / 6)); // "píxel" de la textura
      const n = Math.floor(size / px);
      c.fillStyle = color;
      c.fillRect(x, y, size, size);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const edgeLight = i === 0 || j === 0;
          const edgeDark = i === n - 1 || j === n - 1;
          if (edgeDark) c.fillStyle = "rgba(0,0,0,0.38)";
          else if (edgeLight) c.fillStyle = "rgba(255,255,255,0.4)";
          else if ((i + j) % 2 === 0) c.fillStyle = "rgba(255,255,255,0.13)";
          else continue;
          c.fillRect(x + i * px, y + j * px, px, px);
        }
      }
    },
  },
};

// Orden en el que `S` recorre las skins.
export const SKIN_ORDER: SkinId[] = ["retro", "neon", "pastel", "pixel"];

export function nextSkin(current: SkinId): SkinId {
  return SKIN_ORDER[(SKIN_ORDER.indexOf(current) + 1) % SKIN_ORDER.length];
}

function isSkinId(v: unknown): v is SkinId {
  return SKIN_ORDER.some((id) => id === v);
}

// Lee la skin guardada; Retro si no hay nada o `localStorage` no está disponible.
export function loadSkin(): Skin {
  try {
    const saved = localStorage.getItem(SKIN_KEY);
    if (isSkinId(saved)) return SKINS[saved];
  } catch {
    /* localStorage bloqueado: skin por defecto */
  }
  return SKINS.retro;
}

export function saveSkin(id: SkinId): void {
  try {
    localStorage.setItem(SKIN_KEY, id);
  } catch {
    /* localStorage bloqueado: la elección solo dura la sesión */
  }
}

// Dibuja un bloque en la celda (cx, cy) de tamaño `size`, con alfa opcional.
export function drawBlock(
  c: CanvasRenderingContext2D,
  skin: Skin,
  cx: number,
  cy: number,
  colorIndex: number,
  size: number,
  alpha = 1,
): void {
  const color = skin.colors[colorIndex];
  if (!color) return;
  c.globalAlpha = alpha;
  skin.draw(c, cx * size, cy * size, color, size);
  c.globalAlpha = 1;
}
