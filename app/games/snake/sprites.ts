import { CELL } from "./constants";

export type SpriteRect = { sx: number; sy: number; sw: number; sh: number };

const SHEET_URL = "/games/snake/fruits.png";
const ROW_Y = 136;
const ROW_H = 160;
const FRUIT_DRAW_H = 36; // alto en px dentro de la celda de 40

// Rects de la fila pixel-art por INDICE y en el orden real de la hoja.
// Los nombres de references/source-assets/snake-assets/sprites.js estan
// desplazados, por eso aqui solo se usan x/w y el nombre real va en comentario.
const FRUIT_COLUMNS: ReadonlyArray<readonly [x: number, w: number]> = [
  [34, 110], // 0 manzana
  [186, 150], // 1 platano
  [378, 110], // 2 pina
  [540, 130], // 3 uvas
  [712, 130], // 4 calabaza
  [894, 110], // 5 nabo
  [1066, 110], // 6 berenjena
  [1228, 130], // 7 fresa
  [1400, 130], // 8 cerezas
  [1582, 110], // 9 zanahorias
  [1734, 150], // 10 champinon
  [1906, 150], // 11 brocoli
  [2068, 170], // 12 sandia
  [2250, 140], // 13 pimiento verde
  [2432, 130], // 14 kiwi
  [2604, 130], // 15 limon
  [2786, 110], // 16 naranja
  [2948, 130], // 17 melocoton
  [3110, 150], // 18 cacahuete
  [3302, 110], // 19 frambuesa
  [3454, 150], // 20 tomate
  [3637, 130], // 21 cuenco de fruta
];

export const FRUIT_COUNT = FRUIT_COLUMNS.length;

export const FRUIT_RECTS: SpriteRect[] = FRUIT_COLUMNS.map(([sx, sw]) => ({
  sx,
  sy: ROW_Y,
  sw,
  sh: ROW_H,
}));

export type Sprites = {
  // Dibuja la fruta `index` centrada en la celda (cx, cy). No hace nada hasta
  // que la imagen ha cargado.
  drawFruit(
    ctx: CanvasRenderingContext2D,
    index: number,
    cx: number,
    cy: number,
  ): void;
};

// Carga la hoja y devuelve funciones de dibujo. `onLoad` no se llama si ya se
// llamo a `isDestroyed()` antes de que cargue la imagen.
export function loadSprites(
  onLoad: () => void,
  isDestroyed: () => boolean,
): Sprites {
  let sheet: HTMLImageElement | null = null;

  const img = new Image();
  img.onload = () => {
    if (isDestroyed()) return;
    sheet = img;
    onLoad();
  };
  img.onerror = () => {
    if (!isDestroyed()) console.error("Failed to load Snake fruit sheet");
  };
  img.src = SHEET_URL;

  return {
    drawFruit(ctx, index, cx, cy) {
      const r = FRUIT_RECTS[index];
      if (!sheet || !r) return;
      const dh = Math.min(FRUIT_DRAW_H, CELL);
      const dw = Math.round((r.sw / r.sh) * dh);
      const prev = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        sheet,
        r.sx,
        r.sy,
        r.sw,
        r.sh,
        Math.round(cx - dw / 2),
        Math.round(cy - dh / 2),
        dw,
        dh,
      );
      ctx.imageSmoothingEnabled = prev;
    },
  };
}
