import type {
  GameEngine,
  GameEngineEvents,
  GameStats,
} from "../../lib/games/types";
import { moveCar } from "./car";
import { CAR, CFG, MAST, SCORE } from "./constants";
import { createGuard, type Guard, touchesCar, updateGuard } from "./guards";
import { buildRound, DIRS, type Maze, roomCenter, type Vec } from "./maze";
import { drawScene, type Mast, type Phase } from "./render";
import { loadSkin, nextSkin, saveSkin, SKINS } from "./skins";

const MOVE_KEYS: Record<string, Vec> = {
  ArrowUp: DIRS[0],
  KeyW: DIRS[0],
  ArrowRight: DIRS[1],
  KeyD: DIRS[1],
  ArrowDown: DIRS[2],
  KeyS: DIRS[2],
  ArrowLeft: DIRS[3],
  KeyA: DIRS[3],
};

const parFor = (round: number) =>
  Math.max(CFG.parMin, CFG.parBase - CFG.parDelta * (round - 1));

// Motor de Banderas. Todo el estado vive en el cierre: se pueden crear y
// destruir varias instancias (StrictMode monta dos veces).
export function createBanderasGame(
  canvas: HTMLCanvasElement,
  events: GameEngineEvents,
): GameEngine {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("Canvas 2D no disponible");
  const ctx: CanvasRenderingContext2D = ctx2d;

  let skin = loadSkin();
  let phase: Phase = "ready";
  let paused = false;
  let destroyed = false;
  let gameOverEmitted = false;
  let lastStats: GameStats | null = null;

  let score = 0;
  let lives: number = CFG.lives;
  let livesAwarded = 0; // múltiplos de 5.000 ya cruzados
  let round = 1;
  let maze: Maze = new Uint8Array();
  let masts: Mast[] = [];
  let guards: Guard[] = [];
  let rng: () => number = Math.random;

  let car: Vec = { x: CAR.startX, y: CAR.startY };
  let facing: Vec = DIRS[0];
  let invulnLeft = 0;
  let par = 0;
  let rhythm = 0; // segundos desde el último izado o el inicio de la ronda
  let phaseLeft = 0; // segundos que quedan de `dead` o `clear`
  let clearBonus = 0;
  let time = 0; // reloj de animación

  let held: string[] = []; // la última pulsada manda

  function stats(): GameStats {
    return { score, lives: phase === "gameover" ? 0 : lives, level: round };
  }

  function emitStats() {
    const s = stats();
    if (
      lastStats &&
      lastStats.score === s.score &&
      lastStats.lives === s.lives &&
      lastStats.level === s.level
    )
      return;
    lastStats = s;
    events.onStats(s);
  }

  function addScore(points: number) {
    score = Math.min(SCORE.max, score + points);
    const earned = Math.floor(score / SCORE.extraLifeEvery);
    lives = Math.min(CFG.maxLives, lives + earned - livesAwarded);
    livesAwarded = earned;
  }

  function placeCar() {
    car = { x: CAR.startX, y: CAR.startY };
    facing = DIRS[0];
  }

  function loadRound(n: number) {
    round = n;
    const built = buildRound(n);
    maze = built.maze;
    rng = built.rng;
    masts = built.masts.map((r) => ({
      ...roomCenter(r),
      progress: 0,
      raised: false,
    }));
    guards = built.guards.map((r) => createGuard(r, maze, rng));
    par = parFor(n);
    rhythm = 0;
    invulnLeft = 0;
    placeCar();
  }

  function reset() {
    score = 0;
    lives = CFG.lives;
    livesAwarded = 0;
    phaseLeft = 0;
    clearBonus = 0;
    held = [];
    paused = false;
    gameOverEmitted = false;
    phase = "ready";
    loadRound(1);
    emitStats();
  }

  // Único final de partida: derrota y end().
  function finish() {
    if (phase === "gameover") return;
    phase = "gameover";
    paused = false;
    held = [];
    emitStats();
    if (!gameOverEmitted) {
      gameOverEmitted = true;
      events.onGameOver(stats());
    }
  }

  function die() {
    lives -= 1;
    phase = "dead";
    phaseLeft = CFG.deathMs / 1000;
    for (const m of masts) if (!m.raised) m.progress = 0;
    emitStats();
  }

  function respawn() {
    placeCar();
    invulnLeft = CAR.respawnInvulnMs / 1000;
    guards = guards.map((g) => createGuard(g.home, maze, rng));
    phase = "playing";
  }

  function updateMasts(dt: number) {
    for (const m of masts) {
      if (m.raised) continue;
      if (Math.hypot(car.x - m.x, car.y - m.y) > MAST.holdRadius) {
        m.progress = 0;
        continue;
      }
      m.progress += dt / MAST.holdSec;
      if (m.progress < 1) continue;
      m.progress = 1;
      m.raised = true;
      addScore(
        SCORE.mast + (rhythm <= SCORE.rhythmSec ? SCORE.rhythmBonus : 0),
      );
      rhythm = 0;
      if (masts.every((o) => o.raised)) {
        clearBonus = SCORE.roundBase + SCORE.roundPerParSec * Math.floor(par);
        addScore(clearBonus);
        phase = "clear";
        phaseLeft = CFG.clearMs / 1000;
      }
      emitStats();
    }
  }

  function update(dt: number) {
    if (paused || phase === "ready" || phase === "gameover") return;
    time += dt;

    if (phase === "clear") {
      phaseLeft -= dt;
      if (phaseLeft <= 0) {
        loadRound(round + 1);
        phase = "playing";
        emitStats();
      }
      return;
    }

    par = Math.max(0, par - dt);
    rhythm += dt;

    if (phase === "dead") {
      phaseLeft -= dt;
      if (phaseLeft <= 0) {
        if (lives <= 0) finish();
        else respawn();
      }
      return;
    }

    invulnLeft = Math.max(0, invulnLeft - dt);
    const dir = held.length > 0 ? MOVE_KEYS[held[held.length - 1]] : null;
    if (dir) {
      facing = dir;
      car = moveCar(maze, car, dir, dt);
    }
    for (const g of guards) updateGuard(g, maze, car, round, dt, rng);
    if (invulnLeft === 0 && guards.some((g) => touchesCar(g, car))) {
      die();
      return;
    }
    updateMasts(dt);
  }

  function draw() {
    drawScene(
      ctx,
      {
        phase,
        paused,
        score,
        lives: phase === "gameover" ? 0 : lives,
        round,
        maze,
        masts,
        guards,
        car,
        facing,
        invulnerable: invulnLeft > 0,
        par,
        deathTime: CFG.deathMs / 1000 - phaseLeft,
        clearBonus,
        time,
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
    const dt = Math.min(CFG.dtMax, Math.max(0, ts - lastTime) / 1000);
    lastTime = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  // ---- Entrada ----

  function onKeyDown(e: KeyboardEvent) {
    const t = e.target;
    if (
      t instanceof HTMLElement &&
      (t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "BUTTON" ||
        t.isContentEditable)
    )
      return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const isMove = e.code in MOVE_KEYS;
    if (!isMove && e.code !== "Space" && e.code !== "KeyP" && e.code !== "KeyK")
      return;
    e.preventDefault();
    // Mantener una tecla no repite acciones (tampoco reinicia al perder).
    if (e.repeat) return;

    if (isMove) {
      held = [...held.filter((c) => c !== e.code), e.code];
      return;
    }
    if (e.code === "KeyP") {
      if (phase === "ready" || phase === "gameover") return;
      if (paused) resume();
      else pause();
      events.onPauseChange?.(paused);
      return;
    }
    if (paused) return;
    // Cambio de skin: también en `ready` y con la partida terminada.
    if (e.code === "KeyK") {
      skin = SKINS[nextSkin(skin.id)];
      saveSkin(skin.id);
      draw();
      return;
    }
    if (phase === "ready") phase = "playing";
    else if (phase === "gameover") {
      events.onRestart(); // antes de onStats: el HUD parte de cero
      reset();
      startLoop();
    }
  }

  // Se suelta siempre, aunque el foco esté en un campo.
  function onKeyUp(e: KeyboardEvent) {
    held = held.filter((c) => c !== e.code);
  }

  function onBlur() {
    held = [];
  }

  function pause() {
    if (phase !== "gameover") paused = true;
  }

  function resume() {
    if (!paused) return;
    paused = false;
    lastTime = performance.now();
  }

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
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
}
