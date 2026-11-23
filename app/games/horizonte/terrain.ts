import { H, PLAY_H, PLAY_TOP, SECTOR, TERRAIN } from "./constants";
import { mulberry32, randInt } from "./rng";

// Rectángulo en coordenadas de mundo: x = dist + x de pantalla; y de pantalla.
export type Rect = { x: number; y: number; w: number; h: number };

export type Terrain = {
  reset(): void;
  // Hueco mínimo para las columnas que se generen a partir de ahora.
  setGapMin(gapMin: number): void;
  // Genera columnas hasta cubrir `worldX` (inclusive).
  ensure(worldX: number): void;
  // y de pantalla del borde inferior del techo en esa x de mundo.
  ceilAt(worldX: number): number;
  // y de pantalla del borde superior del suelo en esa x de mundo.
  floorAt(worldX: number): number;
  // ¿El rectángulo (mundo) toca techo o suelo?
  rectHitsTerrain(rect: Rect): boolean;
};

// Hueco mínimo del sector (sector >= 1): max(200, 360 - 20 × (sector - 1)).
export function gapMinFor(sector: number): number {
  return Math.max(
    SECTOR.gapMinFloor,
    SECTOR.gapMin - SECTOR.gapMinDelta * (sector - 1),
  );
}

// Columnas que se conservan: 800 px visibles + margen para las apariciones en
// x = 820 y las consultas por detrás de la nave.
const BUFFER = 64;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// Terreno por columnas de 20 px. Solo depende del recorrido y de la semilla,
// así que dos partidas generan la misma caverna. Estado en el cierre.
export function createTerrain(): Terrain {
  const ceil = new Int16Array(BUFFER); // grosor del techo
  const floor = new Int16Array(BUFFER); // grosor del suelo
  let next = 0; // índice de la siguiente columna por generar
  let rand = mulberry32(TERRAIN.seed);
  let gapMin = gapMinFor(1);
  const flatCols = Math.floor(TERRAIN.flatStart / TERRAIN.col);

  function generate() {
    const i = next;
    let top: number;
    let bottom: number;
    if (i < flatCols) {
      top = TERRAIN.flatThick;
      bottom = TERRAIN.flatThick;
    } else {
      const prevTop = ceil[(i - 1) % BUFFER];
      const prevBottom = floor[(i - 1) % BUFFER];
      top = clamp(
        prevTop + randInt(rand, -TERRAIN.step, TERRAIN.step),
        TERRAIN.thickMin,
        TERRAIN.thickMax,
      );
      bottom = clamp(
        prevBottom + randInt(rand, -TERRAIN.step, TERRAIN.step),
        TERRAIN.thickMin,
        TERRAIN.thickMax,
      );
      const gap = PLAY_H - top - bottom;
      if (gap < gapMin) {
        const diff = gapMin - gap;
        // Se resta al mayor de los dos.
        if (top >= bottom) top = Math.max(TERRAIN.thickMin, top - diff);
        else bottom = Math.max(TERRAIN.thickMin, bottom - diff);
      }
    }
    ceil[i % BUFFER] = top;
    floor[i % BUFFER] = bottom;
    next += 1;
  }

  // Columna de una x de mundo, limitada a las que siguen en el buffer.
  function column(worldX: number): number {
    const i = Math.floor(worldX / TERRAIN.col);
    return Math.max(i, next - BUFFER, 0);
  }

  function ensure(worldX: number) {
    const target = Math.floor(worldX / TERRAIN.col);
    while (next <= target) generate();
  }

  function ceilAt(worldX: number): number {
    ensure(worldX);
    return PLAY_TOP + ceil[column(worldX) % BUFFER];
  }

  function floorAt(worldX: number): number {
    ensure(worldX);
    return H - floor[column(worldX) % BUFFER];
  }

  function rectHitsTerrain(r: Rect): boolean {
    ensure(r.x + r.w);
    const first = column(r.x);
    // El borde derecho es exclusivo: un rectángulo que acaba justo en una
    // frontera de columna no toca la siguiente.
    const last = Math.max(
      first,
      Math.ceil((r.x + r.w) / TERRAIN.col) - 1,
      next - BUFFER,
    );
    for (let i = first; i <= last; i++) {
      const slot = i % BUFFER;
      if (r.y < PLAY_TOP + ceil[slot]) return true;
      if (r.y + r.h > H - floor[slot]) return true;
    }
    return false;
  }

  function reset() {
    ceil.fill(0);
    floor.fill(0);
    next = 0;
    rand = mulberry32(TERRAIN.seed);
    gapMin = gapMinFor(1);
  }

  return {
    reset,
    setGapMin(g) {
      gapMin = g;
    },
    ensure,
    ceilAt,
    floorAt,
    rectHitsTerrain,
  };
}
