import { W } from "./constants";

export type LaneKind = "log" | "turtle" | "car" | "bus" | "fastcar" | "truck";

export type Lane = {
  row: number;
  kind: LaneKind;
  dir: 1 | -1;
  v: number; // px/s en el nivel 1
  len: number; // celdas
  count: number;
  spacing: number; // px entre objetos
  L: number; // count × spacing: periodo de envoltura
  phaseMs: number; // desfase del ciclo de inmersión (solo tortugas)
};

function lane(
  row: number,
  kind: LaneKind,
  dir: 1 | -1,
  v: number,
  len: number,
  count: number,
  spacing: number,
  phaseMs = 0,
): Lane {
  return {
    row,
    kind,
    dir,
    v,
    len,
    count,
    spacing,
    L: count * spacing,
    phaseMs,
  };
}

export const LANES: Lane[] = [
  // Río
  lane(1, "log", -1, 90, 2, 3, 300),
  lane(2, "turtle", 1, 70, 3, 3, 320, 0),
  lane(3, "log", -1, 100, 4, 2, 480),
  lane(4, "turtle", 1, 80, 2, 3, 300, 3000),
  lane(5, "log", -1, 60, 3, 3, 320),
  // Carretera
  lane(7, "car", 1, 110, 1, 3, 300),
  lane(8, "bus", -1, 50, 3, 2, 480),
  lane(9, "car", 1, 90, 1, 3, 300),
  lane(10, "fastcar", -1, 130, 1, 2, 440),
  lane(11, "truck", 1, 60, 2, 3, 320),
  lane(12, "car", -1, 100, 1, 3, 280),
  lane(13, "car", 1, 70, 1, 3, 320),
];

export const LANE_BY_ROW: Record<number, Lane> = Object.fromEntries(
  LANES.map((l) => [l.row, l]),
);

// Garantía del spec: el salto de envoltura ocurre fuera de pantalla.
if (process.env.NODE_ENV !== "production") {
  for (const l of LANES) {
    if (l.L < W + l.len * 40) {
      throw new Error(`Carril ${l.row}: L < ${W} + len × 40`);
    }
  }
}
