import type {
  GameEngine,
  GameEngineEvents,
  GameStats,
} from "../../lib/games/types";
import {
  CELL,
  CFG,
  COLS,
  HOMES,
  ROWS,
  ROW_GOAL,
  ROW_RIVER_BOTTOM,
  ROW_RIVER_TOP,
  ROW_START,
  W,
} from "./constants";
import {
  clampScore,
  hitsVehicle,
  homeAt,
  landX,
  platformAt,
  speedMul,
  timeFor,
} from "./logic";
import { drawScene } from "./render";
import { loadSkin, nextSkin, saveSkin, type Skin, SKINS } from "./skins";

type Phase = "ready" | "playing" | "dying" | "levelclear" | "gameover";
type Dir = "up" | "down" | "left" | "right";
type DeathCause = "car" | "water" | "time" | "goal";

function inRiver(row: number): boolean {
  return row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOTTOM;
}

// Motor de Frogger. Todo el estado vive dentro de la factoria (sin globales),
// asi que se pueden crear y destruir instancias (StrictMode monta dos veces).
//
// Paso 4: nucleo (estado, fases, salto con bloqueo, arrastre en el rio,
// colisiones, reloj, casillas, puntuacion, vidas y nivel). Bucle y teclado:
// paso 5. Dibujo: paso 6. Ciclo de vida completo: paso 7.
export function createFroggerGame(
  canvas: HTMLCanvasElement,
  events: GameEngineEvents,
): GameEngine {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("Canvas 2D no disponible");
  const ctx: CanvasRenderingContext2D = ctx2d;

  let skin: Skin = loadSkin();

  let phase: Phase = "ready";
  let paused = false;
  let destroyed = false;
  let gameOverEmitted = false;
  let lastStats: GameStats | null = null;

  let score = 0;
  let lives: number = CFG.lives;
  let level = 1;
  let filled: boolean[] = HOMES.map(() => false);

  // Rana: `row` entero, `x` en px (continuo en el rio, multiplo de 40 fuera).
  let frogX = CFG.startCol * CELL;
  let frogRow = ROW_START;
  let facing: Dir = "up";
  let prevX = frogX; // origen de la animacion del salto
  let prevRow = frogRow;
  let hopLeftMs = 0; // >0: salto en curso, no se acepta otra pulsacion
  let maxRow = ROW_START; // fila mas cercana a la meta de esta rana
  let timeLeftMs: number = CFG.timeMs;

  let laneT = 0; // segundos de juego de los carriles
  let deathLeftMs = 0;
  let deathCause: DeathCause = "car";
  let levelClearLeftMs = 0;

  // lives: reales (3 al empezar), 0 en gameover.
  function stats(): GameStats {
    return {
      score,
      lives: phase === "gameover" ? 0 : lives,
      level,
    };
  }

  // Solo emite cuando cambia algun valor.
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

  function addScore(points: number) {
    score = clampScore(score + points);
  }

  // Rana nueva en la salida, con el reloj lleno y el maximo de fila reiniciado.
  function spawnFrog() {
    frogX = CFG.startCol * CELL;
    frogRow = ROW_START;
    facing = "up";
    prevX = frogX;
    prevRow = frogRow;
    hopLeftMs = 0;
    maxRow = ROW_START;
    timeLeftMs = timeFor(level);
  }

  function reset() {
    score = 0;
    lives = CFG.lives;
    level = 1;
    filled = HOMES.map(() => false);
    laneT = 0;
    deathLeftMs = 0;
    levelClearLeftMs = 0;
    paused = false;
    gameOverEmitted = false;
    phase = "ready";
    spawnFrog();
    emitStats();
  }

  // Un unico punto de salida para derrota y end().
  function finish() {
    if (phase === "gameover") return;
    phase = "gameover";
    paused = false;
    emitStats();
    if (!gameOverEmitted) {
      gameOverEmitted = true;
      events.onGameOver(stats());
    }
  }

  // Espacio en `ready`: arranca sin saltar.
  function begin() {
    if (phase === "ready" && !paused) phase = "playing";
  }

  // Muerte: animacion de 900 ms y una vida menos. Con 0 vidas, el gameover
  // llega al acabar la animacion.
  function die(cause: DeathCause) {
    if (phase !== "playing") return;
    phase = "dying";
    deathCause = cause;
    deathLeftMs = CFG.deathMs;
    hopLeftMs = 0;
    lives = Math.max(0, lives - 1);
    emitStats();
  }

  function startNextLevel() {
    level += 1;
    filled = HOMES.map(() => false);
    laneT = 0; // el multiplicador cambia: se reinician los carriles para no saltar
    spawnFrog();
    phase = "playing";
    emitStats();
  }

  // Salto discreto de una celda. En `ready`, la primera direccion tambien arranca.
  function hop(dir: Dir) {
    if (paused || destroyed) return;
    if (phase === "ready") phase = "playing";
    if (phase !== "playing" || hopLeftMs > 0) return;

    let nx = frogX;
    let nrow = frogRow;
    if (dir === "up") nrow -= 1;
    else if (dir === "down") nrow = Math.min(ROWS - 1, nrow + 1);
    else if (dir === "left") nx -= CELL;
    else nx += CELL;

    // Un salto lateral que saldria de 0..760 se ignora.
    if (nx < 0 || nx > (COLS - 1) * CELL) return;
    if (nrow === frogRow && nx === frogX && dir === "down") return;

    prevX = frogX;
    prevRow = frogRow;
    frogX = inRiver(nrow) ? nx : landX(nx);
    frogRow = nrow;
    facing = dir;
    hopLeftMs = CFG.hopMs;

    // +10 la primera vez que alcanza una fila mas cercana a la meta.
    if (frogRow < maxRow) {
      maxRow = frogRow;
      addScore(CFG.pointsRow);
    }

    if (frogRow === ROW_GOAL) {
      const idx = homeAt(frogX + CELL / 2, filled);
      if (idx < 0) {
        die("goal"); // fuera de un hueco o en uno ya lleno
      } else {
        filled[idx] = true;
        addScore(
          CFG.pointsHome +
            CFG.pointsTimePerSecond * Math.floor(timeLeftMs / 1000),
        );
        if (filled.every(Boolean)) {
          addScore(CFG.pointsLevelClear);
          phase = "levelclear";
          levelClearLeftMs = CFG.levelClearMs;
        } else {
          spawnFrog();
        }
      }
    }
    emitStats();
  }

  // `dt` en segundos, con tope de 0,05 s.
  function update(rawDt: number) {
    if (paused || destroyed) return;
    const dt = Math.min(rawDt, 0.05);
    const ms = dt * 1000;
    const m = speedMul(level);

    if (phase === "levelclear") {
      // Carriles parados durante la pausa.
      levelClearLeftMs -= ms;
      if (levelClearLeftMs <= 0) startNextLevel();
      return;
    }

    if (phase === "dying") {
      laneT += dt; // los carriles siguen moviendose
      deathLeftMs -= ms;
      if (deathLeftMs <= 0) {
        if (lives <= 0) {
          finish();
        } else {
          spawnFrog();
          phase = "playing";
        }
      }
      return;
    }

    if (phase !== "playing") return;

    laneT += dt;
    if (hopLeftMs > 0) hopLeftMs = Math.max(0, hopLeftMs - ms);
    const state = { t: laneT, m };

    // Rio: sobrevive solo sobre una plataforma no sumergida, que la arrastra.
    if (inRiver(frogRow)) {
      const platform = platformAt(frogRow, frogX + CELL / 2, state);
      if (!platform) {
        die("water");
        return;
      }
      frogX += platform.lane.dir * platform.lane.v * m * dt;
      const center = frogX + CELL / 2;
      if (center < 0 || center >= W) {
        die("water");
        return;
      }
    } else if (hitsVehicle({ x: frogX, row: frogRow }, state)) {
      die("car");
      return;
    }

    // Reloj de rana.
    timeLeftMs -= ms;
    if (timeLeftMs <= 0) {
      timeLeftMs = 0;
      die("time");
    }
  }

  // ---- Dibujo ----

  function draw() {
    if (destroyed) return;
    drawScene(
      ctx,
      {
        phase,
        paused,
        score,
        lives: phase === "gameover" ? 0 : lives,
        level,
        filled,
        frogX,
        frogRow,
        prevX,
        prevRow,
        hop: 1 - hopLeftMs / CFG.hopMs,
        facing,
        death: 1 - Math.max(0, deathLeftMs) / CFG.deathMs,
        deathCause,
        timeFrac: timeLeftMs / timeFor(level),
        laneT,
        m: speedMul(level),
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

  // ---- Entrada ----

  const HOP_KEYS: Record<string, Dir> = {
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
  };

  function onKeyDown(e: KeyboardEvent) {
    // Escribiendo en un campo o pulsando un boton: no es del juego.
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

    const dir = HOP_KEYS[e.code];
    if (!dir && e.code !== "Space" && e.code !== "KeyP" && e.code !== "KeyK")
      return;
    // preventDefault solo en teclas del juego (evita el scroll con flechas y Espacio).
    e.preventDefault();

    // Un salto por pulsacion y una accion por tecla: la repeticion no cuenta.
    // Si Espacio seguia pulsado al perder, hay que soltarlo y volver a pulsar.
    if (e.repeat) return;

    if (e.code === "KeyP") {
      // Con la partida terminada no hay nada que pausar ni reanudar.
      if (phase === "gameover") return;
      if (paused) resume();
      else pause();
      events.onPauseChange?.(paused);
      return;
    }
    // En pausa el teclado del juego esta bloqueado.
    if (paused) return;

    // Cambio de skin: tambien con la partida terminada.
    if (e.code === "KeyK") {
      skin = SKINS[nextSkin(skin.id)];
      saveSkin(skin.id);
      draw();
      return;
    }

    if (dir) {
      hop(dir);
      return;
    }
    // Espacio: arranca desde `ready` y reinicia al terminar.
    if (phase === "ready") begin();
    else if (phase === "gameover") {
      events.onRestart(); // antes de onStats: el HUD parte de cero
      reset();
      startLoop();
    }
  }

  // ---- Pausa ----

  // Solo hay algo que pausar mientras la partida no ha terminado.
  function pause() {
    if (phase !== "gameover") paused = true;
  }

  function resume() {
    if (!paused) return;
    paused = false;
    lastTime = performance.now(); // sin salto de tiempo al reanudar
  }

  reset();
  draw();
  window.addEventListener("keydown", onKeyDown);

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
    },
  };
}
