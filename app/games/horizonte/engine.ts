import type {
  GameEngine,
  GameEngineEvents,
  GameStats,
} from "../../lib/games/types";
import { CFG, GATE, SECTOR, SHIP, SHOT, W } from "./constants";
import {
  type Enemy,
  type EnemyBullet,
  type Gate,
  type Shot,
  type Ship,
  type World,
  circleHitsRect,
  createGate,
  createShip,
  createShot,
  rectsOverlap,
  gateRect,
  shipRect,
  shotRect,
  toWorld,
  updateBullet,
  updateEnemy,
  updateGate,
  updateShip,
  updateShot,
} from "./entities";
import { type Explosion, EXPLOSION_MS, createStars, drawScene } from "./render";
import { loadSkin, nextSkin, saveSkin, SKINS } from "./skins";
import { createTerrain, gapMinFor } from "./terrain";
import { createWaves } from "./waves";

type Phase = "ready" | "playing" | "dying" | "gameover";

// Unidades de un Enjambre que hay que derribar para cobrar el bonus.
const SWARM_SIZE = 5;

// Motor de Horizonte. Todo el estado vive dentro de la factoría (sin globales),
// así que se pueden crear y destruir instancias (StrictMode monta dos veces).
//
// Paso 5: núcleo (estado, fases, scroll, oleadas y puertas, colisiones,
// puntuación, vidas, muerte, reaparición y sectores). Teclado de movimiento y
// disparo: paso 6. Dibujo: paso 7 (render.ts). Ciclo de vida (tecla P, Espacio
// en game over): paso 8.
export function createHorizonteGame(
  canvas: HTMLCanvasElement,
  events: GameEngineEvents,
): GameEngine {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("Canvas 2D no disponible");
  const ctx: CanvasRenderingContext2D = ctx2d;

  const terrain = createTerrain();
  const waves = createWaves();

  let phase: Phase = "ready";
  let paused = false;
  let gameOverEmitted = false;
  let lastStats: GameStats | null = null;
  let destroyed = false;
  // Espacio también dispara: tras el game over hay que soltarlo antes de que
  // una nueva pulsación reinicie.
  let spaceReleased = true;

  let dist = 0; // recorrido acumulado (px)
  let bonus = 0; // puntos de enemigos, enjambres y puertas
  let score = 0;
  let lives: number = CFG.lives;
  let gatesDestroyed = 0;
  let nextExtraLife: number = CFG.extraLifeEvery;
  let quietUntil = 0; // sin oleadas hasta este recorrido (tras reaparecer)
  let shotCooldownMs = 0;
  let deathMs = 0; // tiempo restante de la explosión

  let ship: Ship = createShip(320);
  let shots: Shot[] = [];
  let enemies: Enemy[] = [];
  let bullets: EnemyBullet[] = [];
  let gate: Gate | null = null;
  const swarmKills = new Map<number, number>();
  let explosion: Explosion | null = null;
  const stars = createStars();
  let skin = loadSkin();

  // Entrada: la rellena el teclado (ver "Entrada" más abajo).
  const input = { dx: 0, dy: 0, fire: false, launch: false };

  function sector(): number {
    return 1 + gatesDestroyed;
  }

  // Px/s del sector actual: min(220, 120 + 10 × (sector - 1)).
  function scrollSpeed(): number {
    return Math.min(
      SECTOR.scrollMax,
      SECTOR.scroll + SECTOR.scrollDelta * (sector() - 1),
    );
  }

  function stats(): GameStats {
    return { score, lives, level: sector() };
  }

  // Solo emite cuando cambia algún valor.
  function emitStats() {
    const s = stats();
    if (
      lastStats &&
      lastStats.score === s.score &&
      lastStats.lives === s.lives &&
      lastStats.level === s.level
    ) {
      return;
    }
    lastStats = s;
    events.onStats(s);
  }

  function reset() {
    terrain.reset();
    waves.reset();
    dist = 0;
    bonus = 0;
    score = 0;
    lives = CFG.lives;
    gatesDestroyed = 0;
    nextExtraLife = CFG.extraLifeEvery;
    quietUntil = 0;
    shotCooldownMs = 0;
    deathMs = 0;
    ship = createShip(320);
    shots = [];
    enemies = [];
    bullets = [];
    gate = null;
    swarmKills.clear();
    explosion = null;
    terrain.ensure(W + 300);
    paused = false;
    gameOverEmitted = false;
    phase = "ready";
    emitStats();
  }

  // Un único punto de salida para la derrota y end().
  function finish() {
    if (phase === "gameover") return;
    phase = "gameover";
    paused = false;
    spaceReleased = !input.fire; // si seguía pulsado, hay que soltarlo
    emitStats();
    if (!gameOverEmitted) {
      gameOverEmitted = true;
      events.onGameOver(stats());
    }
  }

  // Despega desde `ready`.
  function begin() {
    if (phase === "ready" && !paused) phase = "playing";
  }

  // score = floor(dist / 10) + bonus, con tope. Cada múltiplo de 10.000
  // cruzado da una vida (máximo 5).
  function refreshScore() {
    score = Math.min(
      CFG.scoreMax,
      Math.floor(dist / CFG.distancePointPx) + bonus,
    );
    while (score >= nextExtraLife) {
      lives = Math.min(CFG.maxLives, lives + 1);
      nextExtraLife += CFG.extraLifeEvery;
    }
  }

  function hitEnemy(e: Enemy) {
    e.hp -= 1;
    if (e.hp > 0) return;
    e.dead = true;
    bonus += e.points;
    if (e.group > 0) {
      const n = (swarmKills.get(e.group) ?? 0) + 1;
      if (n >= SWARM_SIZE) {
        bonus += CFG.swarmBonus;
        swarmKills.delete(e.group);
      } else {
        swarmKills.set(e.group, n);
      }
    }
  }

  function hitGate(g: Gate) {
    g.hp -= 1;
    if (g.hp > 0) return;
    // Puerta destruida: 500 × sector en el que estaba, y sube de sector.
    bonus += GATE.pointsPerSector * g.sector;
    gate = null;
    gatesDestroyed += 1;
    // El nuevo hueco mínimo se aplica desde la siguiente columna generada.
    terrain.setGapMin(gapMinFor(sector()));
  }

  // Disparos de la nave contra la puerta y los enemigos.
  function resolveShots() {
    for (const s of shots) {
      if (s.dead) continue;
      const box = shotRect(s);
      const g = gate;
      if (g && rectsOverlap(box, gateRect(g))) {
        s.dead = true;
        hitGate(g);
        continue;
      }
      for (const e of enemies) {
        // Un enemigo que aún no ha entrado en pantalla no se puede golpear.
        if (e.dead || e.x - e.r > W) continue;
        if (circleHitsRect(e.x, e.y, e.r, box)) {
          s.dead = true;
          hitEnemy(e);
          break;
        }
      }
    }
  }

  // ¿Toca la nave algo mortal? El terreno y la puerta matan siempre; los
  // enemigos y las balas no mientras dura la invulnerabilidad.
  function shipIsHit(): boolean {
    const box = shipRect(ship);
    if (terrain.rectHitsTerrain(toWorld(box, dist))) return true;
    if (gate && rectsOverlap(box, gateRect(gate))) return true;
    if (ship.invulnMs > 0) return false;
    for (const e of enemies) {
      if (circleHitsRect(e.x, e.y, e.r, box)) return true;
    }
    for (const b of bullets) {
      if (circleHitsRect(b.x, b.y, 4, box)) return true;
    }
    return false;
  }

  function die() {
    lives -= 1;
    phase = "dying";
    deathMs = CFG.deathMs;
    explosion = { x: ship.x, y: ship.y, ageMs: 0 };
    emitStats();
  }

  // Fin de la explosión: reaparece o termina la partida.
  function afterDeath() {
    if (lives <= 0) {
      finish();
      return;
    }
    enemies = [];
    bullets = [];
    swarmKills.clear();
    explosion = null;
    // En el centro del hueco de esa columna, con 2 s de invulnerabilidad
    // frente a enemigos y balas (no frente al terreno).
    const wx = dist + SHIP.startX;
    ship = createShip((terrain.ceilAt(wx) + terrain.floorAt(wx)) / 2);
    ship.invulnMs = SHIP.respawnInvulnMs;
    quietUntil = dist + 300;
    // La puerta no puede reaparecer encima de la nave.
    if (gate && gate.x < GATE.minXOnRespawn) gate.x = GATE.minXOnRespawn;
    phase = "playing";
  }

  // `dt` en segundos, con tope de 0,05 s.
  function update(rawDt: number) {
    if (destroyed || paused) return;
    const dt = Math.min(rawDt, CFG.dtMax);

    if (phase === "ready") {
      if (input.launch) {
        input.launch = false;
        begin();
      }
      return;
    }
    if (phase === "dying") {
      // Explosión: el mundo está congelado.
      deathMs -= dt * 1000;
      if (explosion) explosion.ageMs += dt * 1000;
      if (deathMs <= 0) afterDeath();
      return;
    }
    if (phase !== "playing") return;

    const dtMs = dt * 1000;
    updateShip(ship, dt, { dx: input.dx, dy: input.dy });

    // Scroll, oleadas y puerta.
    dist += scrollSpeed() * dt;
    terrain.ensure(dist + W + 300);
    enemies.push(...waves.update(dist, sector(), quietUntil, terrain));
    if (!gate && dist >= SECTOR.length * sector()) gate = createGate(sector());

    // Autodisparo: el sobrante del cooldown se arrastra para mantener la
    // cadencia, sin acumular ráfagas tras un rato sin disparar.
    shotCooldownMs = Math.max(shotCooldownMs - dtMs, -dtMs);
    if (input.fire && shotCooldownMs <= 0 && shots.length < SHOT.max) {
      shots.push(createShot(ship));
      shotCooldownMs += SHOT.cooldownMs;
    }

    const world: World = {
      scroll: scrollSpeed(),
      dist,
      sector: sector(),
      terrain,
      shipX: ship.x,
      shipY: ship.y,
      addBullet: (b) => bullets.push(b),
    };
    for (const s of shots) updateShot(s, dt, world);
    for (const e of enemies) updateEnemy(e, dt, world);
    for (const b of bullets) updateBullet(b, dt, world);
    if (gate) updateGate(gate, dt, world);

    resolveShots();
    shots = shots.filter((s) => !s.dead);
    enemies = enemies.filter((e) => !e.dead);
    bullets = bullets.filter((b) => !b.dead);

    refreshScore();
    if (shipIsHit()) {
      die();
      return;
    }
    emitStats();
  }

  // ---- Dibujo ----

  function draw() {
    if (destroyed) return;
    drawScene(
      ctx,
      {
        phase,
        paused,
        dist,
        score,
        lives,
        sector: sector(),
        terrain,
        ship,
        // Sin nave mientras explota ni tras perder la última vida.
        shipVisible: phase !== "dying" && !(phase === "gameover" && lives <= 0),
        shots,
        enemies,
        bullets,
        gate,
        explosion:
          explosion && explosion.ageMs < EXPLOSION_MS ? explosion : null,
        stars,
      },
      skin,
    );
  }

  // ---- Bucle ----

  let rafId = 0;
  let lastTime = 0;

  function loop(ts: number) {
    rafId = 0;
    if (destroyed) return;
    const dt = Math.max(0, ts - lastTime) / 1000;
    lastTime = ts;
    update(dt); // update() limita dt a 0,05 s
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // ---- Pausa ----

  // Solo hay algo que pausar mientras la partida no ha terminado.
  function pause() {
    if (phase === "gameover") return;
    paused = true;
  }

  function resume() {
    if (!paused) return;
    paused = false;
    lastTime = performance.now(); // sin salto al reanudar
  }

  // ---- Entrada ----

  // Teclas de movimiento mantenidas (por `code`). Se registran siempre, también
  // en pausa, para que soltar una tecla nunca la deje pegada.
  const held = new Set<string>();

  const MOVE_KEYS: Record<string, "up" | "down" | "left" | "right"> = {
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
  };

  function syncMove() {
    let left = false;
    let right = false;
    let up = false;
    let down = false;
    for (const code of held) {
      const dir = MOVE_KEYS[code];
      if (dir === "left") left = true;
      else if (dir === "right") right = true;
      else if (dir === "up") up = true;
      else if (dir === "down") down = true;
    }
    input.dx = (right ? 1 : 0) - (left ? 1 : 0);
    input.dy = (down ? 1 : 0) - (up ? 1 : 0);
  }

  function onKeyDown(e: KeyboardEvent) {
    // Escribiendo en un campo o pulsando un botón: no es del juego.
    const t = e.target;
    if (
      t instanceof HTMLElement &&
      (t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "BUTTON" ||
        t.isContentEditable)
    ) {
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const isMove = e.code in MOVE_KEYS;
    if (
      !isMove &&
      e.code !== "Space" &&
      e.code !== "KeyP" &&
      e.code !== "KeyK"
    ) {
      return;
    }
    // preventDefault solo en teclas del juego (evita el scroll con flechas y Espacio).
    e.preventDefault();

    if (isMove) {
      held.add(e.code);
      syncMove();
      return;
    }
    if (e.code === "KeyP") {
      if (e.repeat) return;
      // Con la partida terminada no hay nada que pausar ni reanudar.
      if (phase === "gameover") return;
      if (paused) resume();
      else pause();
      events.onPauseChange?.(paused);
      return;
    }
    // K: cambia de skin (también con la partida terminada; S ya es "abajo").
    // En pausa el teclado del juego está bloqueado.
    if (e.code === "KeyK") {
      if (e.repeat || paused) return;
      skin = SKINS[nextSkin(skin.id)];
      saveSkin(skin.id);
      draw();
      return;
    }
    // Espacio: mantener = autodisparo; despega desde `ready` y reinicia tras
    // el game over. Se ignora la repetición.
    input.fire = true;
    if (e.repeat || paused) return;
    if (phase === "ready") {
      input.launch = true;
    } else if (phase === "gameover" && spaceReleased) {
      events.onRestart(); // antes de onStats: el HUD parte de cero
      reset();
      startLoop();
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code in MOVE_KEYS) {
      held.delete(e.code);
      syncMove();
    } else if (e.code === "Space") {
      input.fire = false;
      spaceReleased = true;
    }
  }

  // Si la ventana pierde el foco no llegan los keyup: se suelta todo.
  function onBlur() {
    held.clear();
    syncMove();
    input.fire = false;
  }

  reset();
  draw();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return {
    start() {
      reset();
      startLoop();
    },
    pause,
    resume,
    restart() {
      reset();
      startLoop();
    },
    end() {
      finish();
    },
    destroy() {
      destroyed = true;
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
}
