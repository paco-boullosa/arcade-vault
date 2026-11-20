import type {
  GameEngine,
  GameEngineEvents,
  GameStats,
} from "../../lib/games/types";
import { CFG } from "./constants";
import {
  type Cell,
  type Dir,
  type Fruit,
  canTurn,
  levelFor,
  spawnFruit,
  step,
  stepInterval,
} from "./logic";
import { drawScene } from "./render";
import { loadSkin, nextSkin, saveSkin, SKINS } from "./skins";
import { loadSprites } from "./sprites";

type Phase = "ready" | "playing" | "gameover" | "won";

// Motor de Snake. Todo el estado vive dentro de la factoria (sin globales),
// asi que se pueden crear y destruir instancias (StrictMode monta dos veces).
//
// Paso 4: nucleo (estado, fases, acumulador, cola de giros, comer, crecer,
// puntuacion, nivel, muerte y victoria). Bucle y teclado: paso 5. Dibujo: paso
// 6. Ciclo de vida completo (pausa, destroy, Espacio): paso 7.
export function createSnakeGame(
  canvas: HTMLCanvasElement,
  events: GameEngineEvents,
): GameEngine {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("Canvas 2D no disponible");
  const ctx: CanvasRenderingContext2D = ctx2d;

  let phase: Phase = "ready";
  let snake: Cell[] = [];
  let dir: Dir = "right";
  let turnQueue: Dir[] = []; // giros pendientes, maximo CFG.inputBuffer
  let fruit: Fruit | null = null;
  let prevSprite = -1;
  let fruitsEaten = 0;
  let score = 0;
  let accumMs = 0; // acumulador del paso logico
  let paused = false;
  let gameOverEmitted = false;
  let lastStats: GameStats | null = null;
  let destroyed = false;
  let skin = loadSkin();

  function level(): number {
    return levelFor(fruitsEaten);
  }

  // lives: 1 mientras se juega (y si se gana), 0 en gameover.
  function stats(): GameStats {
    return {
      score,
      lives: phase === "gameover" ? 0 : 1,
      level: level(),
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

  function reset() {
    snake = Array.from({ length: CFG.startLength }, (_, i) => ({
      x: CFG.startX - i,
      y: CFG.startY,
    }));
    dir = "right";
    turnQueue = [];
    fruitsEaten = 0;
    score = 0;
    accumMs = 0;
    paused = false;
    gameOverEmitted = false;
    phase = "ready";
    prevSprite = -1;
    fruit = spawnFruit(snake, prevSprite);
    prevSprite = fruit ? fruit.sprite : -1;
    emitStats();
  }

  // Un unico punto de salida para derrota, victoria y end().
  function finish(won: boolean) {
    if (phase === "gameover" || phase === "won") return;
    phase = won ? "won" : "gameover";
    paused = false;
    emitStats();
    if (!gameOverEmitted) {
      gameOverEmitted = true;
      events.onGameOver(stats());
    }
  }

  // Espacio en `ready`: arranca sin cambiar de direccion.
  function begin() {
    if (phase === "ready" && !paused) phase = "playing";
  }

  // Entrada de direccion. En `ready` la primera pulsacion valida fija la
  // direccion y arranca (`left` se ignora: iria contra el cuerpo). En `playing`
  // entra en la cola, comparada con el ultimo giro en cola (o la direccion
  // actual) para descartar el de 180° y el repetido.
  function queueTurn(next: Dir) {
    if (paused) return;
    if (phase === "ready") {
      if (next === "left") return;
      dir = next;
      phase = "playing";
      return;
    }
    if (phase !== "playing") return;
    if (turnQueue.length >= CFG.inputBuffer) return;
    const reference = turnQueue.length ? turnQueue[turnQueue.length - 1] : dir;
    if (canTurn(reference, next)) turnQueue.push(next);
  }

  // Un paso logico: consume un giro de la cola y mueve la cabeza.
  function advance() {
    const turn = turnQueue.shift();
    if (turn) dir = turn;

    const result = step(snake, dir, fruit);
    if (result.kind === "dead") {
      finish(false);
      return;
    }
    snake = result.snake;
    if (result.kind === "moved") return;

    // Fruta comida: la serpiente ya ha crecido en step().
    fruitsEaten += 1;
    score += CFG.pointsPerFruit;
    fruit = spawnFruit(snake, prevSprite);
    if (fruit) {
      prevSprite = fruit.sprite;
      emitStats();
    } else {
      finish(true); // rejilla llena: victoria (emite stats)
    }
  }

  // `dt` en segundos, con tope de 0,1 s; el paso es de intervalo fijo.
  function update(dt: number) {
    if (phase !== "playing" || paused || destroyed) return;
    accumMs += Math.min(dt, 0.1) * 1000;
    let interval = stepInterval(level());
    while (accumMs >= interval && phase === "playing") {
      accumMs -= interval;
      advance();
      interval = stepInterval(level());
    }
  }

  // ---- Dibujo ----

  // La imagen de las frutas carga de forma asincrona; drawFruit no hace nada
  // hasta entonces. Al cargar se redibuja por si el bucle esta parado.
  const sprites = loadSprites(
    () => draw(),
    () => destroyed,
  );

  function draw() {
    if (destroyed) return;
    drawScene(
      ctx,
      { phase, paused, snake, dir, fruit, score, level: level() },
      sprites,
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
    update(dt); // update() limita dt a 0,1 s
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
    if (phase === "gameover" || phase === "won") return;
    paused = true;
  }

  function resume() {
    if (!paused) return;
    paused = false;
    accumMs = 0; // sin salto de movimiento al reanudar
    lastTime = performance.now();
  }

  // ---- Entrada ----

  const TURN_KEYS: Record<string, Dir> = {
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

    const turn = TURN_KEYS[e.code];
    if (!turn && e.code !== "Space" && e.code !== "KeyP" && e.code !== "KeyK") {
      return;
    }
    // preventDefault solo en teclas del juego (evita el scroll con flechas y Espacio).
    e.preventDefault();

    if (e.code === "KeyP") {
      if (e.repeat) return;
      // Con la partida terminada no hay nada que pausar ni reanudar.
      if (phase === "gameover" || phase === "won") return;
      if (paused) resume();
      else pause();
      events.onPauseChange?.(paused);
      return;
    }
    // En pausa el teclado del juego esta bloqueado.
    if (paused) return;

    // K: cambia de skin (tambien con la partida terminada; S ya es "abajo").
    if (e.code === "KeyK") {
      if (e.repeat) return;
      skin = SKINS[nextSkin(skin.id)];
      saveSkin(skin.id);
      draw();
      return;
    }

    if (turn) {
      queueTurn(turn);
      return;
    }
    // Espacio: arranca desde `ready` y reinicia al terminar. Se ignora la
    // repeticion: si seguia pulsado al morir hay que soltarlo y volver a pulsar.
    if (e.repeat) return;
    if (phase === "ready") begin();
    else if (phase === "gameover" || phase === "won") {
      events.onRestart(); // antes de onStats: el HUD parte de cero
      reset();
      startLoop();
    }
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
      finish(false);
    },
    destroy() {
      destroyed = true;
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
