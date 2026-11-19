import type { BlockColor } from "./constants";

export type SpriteRect = { sx: number; sy: number; sw: number; sh: number };

const SHEET_URL = "/games/arkanoid/spritesheet-breakout.png";

// Mismos valores que assets/spritesheet.js del original
const frames = (sy: number): SpriteRect[] =>
  [256, 288, 320, 352].map((sx) => ({ sx, sy, sw: 32, sh: 16 }));

export const EXPLOSION_FRAMES: Record<BlockColor, SpriteRect[]> = {
  red: frames(176),
  cyan: frames(192),
  green: frames(208),
  magenta: frames(224),
  yellow: frames(240),
  hotpink: frames(256),
  gray: frames(176), // reutiliza los de red
};

export const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  } satisfies Record<BlockColor, SpriteRect>,
};

export type SpriteName = "paddle" | "ball" | `block_${BlockColor}`;

export type Sprites = {
  drawSprite(
    ctx: CanvasRenderingContext2D,
    name: SpriteName,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void;
  drawFrame(
    ctx: CanvasRenderingContext2D,
    frame: SpriteRect,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void;
};

// Carga la hoja y devuelve funciones de dibujo que no hacen nada hasta que la
// imagen está lista. `onLoad` no se llama si ya se llamó a `isDestroyed()`.
export function loadSprites(
  onLoad: () => void,
  isDestroyed: () => boolean,
): Sprites {
  let sheet: HTMLCanvasElement | null = null;

  const img = new Image();
  img.onload = () => {
    if (isDestroyed()) return;
    const oc = document.createElement("canvas");
    oc.width = img.width;
    oc.height = img.height;
    oc.getContext("2d")?.drawImage(img, 0, 0);
    sheet = oc;
    onLoad();
  };
  img.onerror = () => {
    if (!isDestroyed()) console.error("Failed to load Arkanoid spritesheet");
  };
  img.src = SHEET_URL;

  const draw = (
    ctx: CanvasRenderingContext2D,
    r: SpriteRect,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    if (!sheet) return;
    ctx.drawImage(sheet, r.sx, r.sy, r.sw, r.sh, x, y, w, h);
  };

  return {
    drawSprite(ctx, name, x, y, w, h) {
      const r = name.startsWith("block_")
        ? SPRITES.blocks[name.slice(6) as BlockColor]
        : SPRITES[name as "paddle" | "ball"];
      if (r) draw(ctx, r, x, y, w, h);
    },
    drawFrame(ctx, frame, x, y, w, h) {
      draw(ctx, frame, x, y, w, h);
    },
  };
}
