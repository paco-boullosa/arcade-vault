import type {
  GameEngine,
  GameEngineEvents,
  GameStats,
} from "../../lib/games/types";
import {
  CLASSIC,
  MENU_MODES,
  type Challenge,
  type ChallengeState,
  type ModeId,
  findMode,
  pushGarbageRow,
  reverseRotation,
} from "./challenges";
import { FLASH_MS, GARBAGE_EVERY, MAX_SCORE, POWER_EVERY } from "./constants";
import {
  POWERUPS,
  applyPowerUp,
  clearWild,
  powerStatusText,
  randomPower,
} from "./powerups";
import { drawMenu, drawPause, drawScene } from "./render";
import { type Skin, loadSkin, nextSkin, saveSkin, SKINS } from "./skins";
import {
  type Board,
  type Piece,
  clearFullRows,
  collide,
  createBoard,
  dropIntervalFor,
  ghostY,
  levelFor,
  lineScore,
  merge,
  randomPiece,
  tryRotate,
} from "./utils";

// Motor de Tetris. Todo el estado vive dentro de la factoría (sin globales),
// así que se pueden crear y destruir instancias (StrictMode monta dos veces).
//
// Hasta ahora: reglas, bucle, entrada, dibujo, power-ups y modos. El menú y el
// ciclo de vida completo llegan en los pasos 10 y 11.
export function createTetrisGame(
  canvas: HTMLCanvasElement,
  events: GameEngineEvents,
): GameEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");

  let skin: Skin = SKINS.retro;
  let showGhost = true; // `G`; no se reinicia entre partidas

  let board: Board = createBoard();
  let current: Piece = randomPiece();
  let next: Piece = randomPiece();
  let score = 0;
  let lines = 0;
  let level = CLASSIC.startLevel;
  let dropInterval = dropIntervalFor(level);
  let gameOver = false;
  let gameOverEmitted = false;
  let lastStats: GameStats | null = null;

  // Bucle
  let rafId = 0;
  let lastTime = 0;
  let dropAccum = 0;
  let destroyed = false;

  // Menú de modos (se dibuja en el canvas antes de cada partida)
  let inMenu = true;
  let paused = false;
  let menuIndex = 0;

  // Modo de juego (null = Clásico)
  let modeId: ModeId = CLASSIC.id;
  let mode: Challenge | null = null;
  let startLevel = CLASSIC.startLevel;
  let elapsed = 0; // ms de partida; no avanza en pausa
  let garbageAccum = 0;
  let won = false;
  let endReason = "";

  // Power-ups
  let nextPowerAt = POWER_EVERY;
  let pendingPower = false;
  let freezeLeft = 0;
  let wildLeft = 0;
  let flash = { text: "", left: 0 };

  // ---- Estadísticas hacia React ----

  const stats = (): GameStats => ({
    score: Math.min(score, MAX_SCORE),
    lives: gameOver ? 0 : 1,
    level,
  });

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

  // ---- Dibujo ----

  function draw() {
    if (!ctx) return;
    if (inMenu) {
      drawMenu(ctx, MENU_MODES, menuIndex, skin.name);
      if (paused) drawPause(ctx);
      return;
    }
    drawScene(ctx, {
      board,
      current,
      next,
      score: Math.min(score, MAX_SCORE),
      lines,
      level,
      skin,
      showGhost,
      gameOver,
      hideLocked: mode?.id === "invisible",
      goal: mode ? { text: mode.goal, progress: mode.progress(challengeState()) } : null,
      won,
      reason: endReason,
      elapsed,
      frozen: freezeLeft > 0,
      flash,
      powerStatus: powerStatusText(freezeLeft, next, nextPowerAt - lines),
    });
    if (paused) drawPause(ctx);
  }

  // ---- Fin de partida (un único camino) ----

  function finish(victory = false, reason = "") {
    if (gameOver || inMenu) return; // con el menú abierto no hay partida que terminar
    gameOver = true;
    paused = false; // FIN estando en pausa: se muestra la pantalla de fin
    stopLoop();
    won = victory;
    endReason = reason;
    draw();
    emitStats();
    if (!gameOverEmitted) {
      gameOverEmitted = true;
      events.onGameOver(stats());
    }
  }

  // ---- Reglas ----

  // Promueve `next` a pieza actual. Si aparece colisionando, fin de partida.
  function spawn() {
    current = next;
    next = randomPiece();
    // Cada POWER_EVERY líneas, la siguiente pieza lleva un power-up.
    if (pendingPower) {
      next.power = randomPower();
      pendingPower = false;
    }
    if (collide(board, current.shape, current.x, current.y)) finish();
  }

  function clearLines(): number {
    const cleared = clearFullRows(board);
    if (cleared) {
      lines += cleared;
      // Los puntos usan el nivel anterior a recalcularlo.
      score += lineScore(cleared, level);
      level = levelFor(startLevel, lines);
      dropInterval = dropIntervalFor(level);
      while (lines >= nextPowerAt) {
        nextPowerAt += POWER_EVERY;
        pendingPower = true;
      }
    }
    return cleared;
  }

  function lockPiece() {
    merge(board, current);
    if (current.power) {
      // Los power-ups no suman puntos por sí mismos.
      const effect = applyPowerUp(board, current);
      if (effect.freezeMs) freezeLeft = effect.freezeMs;
      if (effect.wildMs) wildLeft = effect.wildMs;
      flash = { text: POWERUPS[current.power].flash, left: FLASH_MS };
    }
    clearLines();
    if (mode?.checkWin?.(challengeState())) {
      finish(true);
      return;
    }
    spawn();
    emitStats();
  }

  function moveLeft() {
    if (!collide(board, current.shape, current.x - 1, current.y)) current.x--;
  }

  function moveRight() {
    if (!collide(board, current.shape, current.x + 1, current.y)) current.x++;
  }

  // +1 por fila bajada; si no puede bajar, se fija y no suma.
  function softDrop() {
    if (!collide(board, current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
      emitStats();
    } else {
      lockPiece();
    }
  }

  // +2 por celda recorrida.
  function hardDrop() {
    const gy = ghostY(board, current);
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function rotate() {
    const result = tryRotate(board, current, reverseRotation(mode, level));
    if (result) {
      current.shape = result.shape;
      current.x = result.x;
    }
  }

  // Caída automática: una fila, o fijar si no puede bajar.
  function gravityStep() {
    if (!collide(board, current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }

  function challengeState(): ChallengeState {
    return { board, lines, level, elapsed, garbageAccum };
  }

  // Sube una fila de basura; termina la partida si llega arriba o aplasta.
  function addGarbageRow() {
    if (!pushGarbageRow(board)) {
      finish(false, "La basura llegó arriba");
      return;
    }
    if (collide(board, current.shape, current.x, current.y)) {
      current.y--;
      if (collide(board, current.shape, current.x, current.y)) {
        finish(false, "La basura te aplastó");
      }
    }
  }

  function pause() {
    if (paused) return;
    paused = true;
    stopLoop();
    draw();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    // startLoop reinicia lastTime: `elapsed` no salta tras una pausa larga.
    if (!inMenu && !gameOver) startLoop();
    draw();
  }

  // Pantalla de menú: HUD a cero con una vida y sin bucle.
  function showMenu() {
    stopLoop();
    inMenu = true;
    paused = false;
    gameOver = false;
    score = 0;
    lines = 0;
    level = CLASSIC.startLevel;
    emitStats();
    draw();
  }

  // `M` en GAME OVER: avisa a React (cierra el modal) y vuelve al menú.
  function backToMenu() {
    events.onRestart(); // antes de onStats: el HUD parte de cero
    showMenu();
  }

  function init(id: ModeId = modeId) {
    inMenu = false;
    paused = false;
    modeId = id;
    mode = findMode(id);
    startLevel = mode?.startLevel ?? CLASSIC.startLevel;
    board = createBoard();
    mode?.setup?.(board);
    elapsed = 0;
    garbageAccum = 0;
    won = false;
    endReason = "";
    score = 0;
    lines = 0;
    level = startLevel;
    dropInterval = dropIntervalFor(level);
    gameOver = false;
    gameOverEmitted = false;
    dropAccum = 0;
    nextPowerAt = POWER_EVERY;
    pendingPower = false;
    freezeLeft = 0;
    wildLeft = 0;
    flash = { text: "", left: 0 };
    next = randomPiece();
    spawn();
    emitStats();
    draw();
  }

  // ---- Bucle ----

  function loop(ts: number) {
    rafId = 0;
    if (gameOver || destroyed) return;
    const dt = Math.max(0, ts - lastTime);
    lastTime = ts;
    // Con Congelar activo la caída automática se detiene.
    if (freezeLeft > 0) freezeLeft = Math.max(0, freezeLeft - dt);
    else dropAccum += dt;
    if (wildLeft > 0) {
      wildLeft -= dt;
      if (wildLeft <= 0) {
        wildLeft = 0;
        clearWild(board);
      }
    }
    if (flash.left > 0) flash.left -= dt;
    elapsed += dt;

    if (mode) {
      if (mode.garbage) {
        garbageAccum += dt;
        while (garbageAccum >= GARBAGE_EVERY && !gameOver) {
          garbageAccum -= GARBAGE_EVERY;
          addGarbageRow();
        }
      }
      if (gameOver) return;
      const state = challengeState();
      if (mode.checkWin?.(state)) {
        finish(true);
        return;
      }
      const loseReason = mode.checkLose?.(state);
      if (loseReason) {
        finish(false, loseReason);
        return;
      }
    }

    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      gravityStep();
    }
    // finish() dentro de gravityStep: no pedir otro frame.
    if (gameOver) return;
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

  const GAME_KEYS = new Set([
    "ArrowLeft",
    "ArrowRight",
    "ArrowDown",
    "ArrowUp",
    "KeyX",
    "Space",
    "KeyG",
    "KeyS",
    "KeyP",
    "Escape",
    "Enter", // solo en el menú
    "KeyM", // solo en GAME OVER
  ]);

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
    if (!GAME_KEYS.has(e.code)) return;
    if (e.code === "Enter" && !inMenu) return;
    if (e.code === "KeyM" && (inMenu || !gameOver)) return;
    // Sin partida (menú o fin) no hay nada que pausar, salvo reanudar.
    if (
      (e.code === "KeyP" || e.code === "Escape") &&
      !paused &&
      (inMenu || gameOver)
    ) {
      return;
    }
    // preventDefault solo en teclas del juego (evita el scroll con flechas y Espacio).
    e.preventDefault();

    if (e.code === "KeyP" || e.code === "Escape") {
      if (paused) resume();
      else pause();
      events.onPauseChange?.(paused);
      return;
    }
    // En pausa el teclado del juego está bloqueado.
    if (paused) return;

    // Ajustes visuales: también con la partida terminada.
    if (e.code === "KeyG") {
      showGhost = !showGhost;
      draw();
      return;
    }
    if (e.code === "KeyS") {
      skin = SKINS[nextSkin(skin.id)];
      saveSkin(skin.id);
      draw();
      return;
    }

    if (inMenu) {
      const n = MENU_MODES.length;
      if (e.code === "ArrowUp") {
        menuIndex = (menuIndex + n - 1) % n;
        draw();
      } else if (e.code === "ArrowDown") {
        menuIndex = (menuIndex + 1) % n;
        draw();
      } else if (e.code === "Enter" || e.code === "Space") {
        init(MENU_MODES[menuIndex].id);
        startLoop();
      }
      return;
    }

    if (e.code === "KeyM") {
      backToMenu();
      return;
    }
    if (gameOver) {
      // Espacio reinicia el mismo modo. Se ignora la repetición: si estaba
      // pulsado al morir, hay que soltarlo y volver a pulsar.
      if (e.code === "Space" && !e.repeat) {
        events.onRestart(); // antes de onStats: el HUD parte de cero
        init();
        startLoop();
      }
      return;
    }

    switch (e.code) {
      case "ArrowLeft":
        moveLeft();
        break;
      case "ArrowRight":
        moveRight();
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        rotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
  }

  skin = loadSkin();
  window.addEventListener("keydown", onKeyDown);

  return {
    start() {
      showMenu();
    },
    pause,
    resume,
    restart() {
      // Con el menú abierto aún no hay modo que reiniciar.
      if (inMenu) return;
      init();
      startLoop();
    },
    end() {
      if (inMenu) return;
      finish();
    },
    destroy() {
      destroyed = true;
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
