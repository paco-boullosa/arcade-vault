import { PLAY_TOP, SECTOR, W, WAVES } from "./constants";
import {
  type Enemy,
  type EnemyKind,
  createEnemy,
  ENEMY_DEFS,
} from "./entities";
import { mulberry32, randInt } from "./rng";
import type { Terrain } from "./terrain";

export type Waves = {
  reset(): void;
  // Devuelve los enemigos que aparecen al llegar a `dist`. `quietUntil` es el
  // recorrido hasta el que no hay oleadas (tras reaparecer).
  update(
    dist: number,
    sector: number,
    quietUntil: number,
    terrain: Terrain,
  ): Enemy[];
};

const SPAWN_X = W + 20; // 820
const MARGIN = 30; // distancia mínima de y0 al techo y al suelo

// Oleadas con semilla fija: cada 450 px de recorrido desde dist = 600. La
// oleada de un punto del recorrido se genera siempre (consume el PRNG) aunque
// luego se descarte por ir en silencio, así que no cambia con las muertes.
export function createWaves(): Waves {
  let rand = mulberry32(WAVES.seed);
  let nextAt: number = WAVES.first;
  let nextGroup = 1;

  function reset() {
    rand = mulberry32(WAVES.seed);
    nextAt = WAVES.first;
    nextGroup = 1;
  }

  function build(dist: number, sector: number, terrain: Terrain): Enemy[] {
    const kinds = (Object.keys(ENEMY_DEFS) as EnemyKind[]).filter(
      (k) => k !== "swarm" && ENEMY_DEFS[k].fromSector <= sector,
    );
    // Dardo y Enjambre cuentan como oleadas distintas; el resto, una cada uno.
    const pool: EnemyKind[] = [...kinds, "swarm"];
    const kind = pool[randInt(rand, 0, pool.length - 1)];

    // Un y0 por oleada, dentro del hueco de la columna donde aparece.
    const wx = dist + SPAWN_X;
    const lo = terrain.ceilAt(wx) + MARGIN;
    const hi = terrain.floorAt(wx) - MARGIN;
    const y0 = lo + rand() * Math.max(0, hi - lo);

    const out: Enemy[] = [];
    switch (kind) {
      case "dart":
        for (let k = 0; k < 3; k++) {
          out.push(createEnemy("dart", SPAWN_X + 60 * k, y0));
        }
        break;
      case "swarm": {
        const group = nextGroup++;
        for (let k = 0; k < 5; k++) {
          // Separados 40 px en x y desfasados 0,25 s.
          out.push(
            createEnemy("swarm", SPAWN_X + 40 * k, y0, {
              group,
              phase: -0.25 * k,
            }),
          );
        }
        break;
      }
      case "turret":
        for (let k = 0; k < 2; k++) {
          out.push(
            createEnemy("turret", SPAWN_X + 200 * k, y0, {
              anchor: rand() < 0.5 ? "ceil" : "floor",
            }),
          );
        }
        break;
      case "buoy":
        for (let k = 0; k < 2; k++) {
          out.push(
            createEnemy("buoy", SPAWN_X + 120 * k, y0, {
              vy: rand() < 0.5 ? -60 : 60,
            }),
          );
        }
        break;
    }
    // Nada por encima de la franja del HUD.
    for (const e of out) e.y0 = Math.max(e.y0, PLAY_TOP + e.r);
    return out;
  }

  function update(
    dist: number,
    sector: number,
    quietUntil: number,
    terrain: Terrain,
  ): Enemy[] {
    const spawned: Enemy[] = [];
    while (dist >= nextAt) {
      const at = nextAt;
      nextAt += WAVES.every;
      const wave = build(dist, sector, terrain);
      const quietGate = at >= SECTOR.length * sector - WAVES.quietBeforeGate;
      if (quietGate || at < quietUntil) continue;
      spawned.push(...wave);
    }
    return spawned;
  }

  return { reset, update };
}
