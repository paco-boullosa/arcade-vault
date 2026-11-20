import {
  CFG,
  EXPLOSION_DURATION,
  H,
  LEVELS,
  W,
  type BlockColor,
} from "./constants";
import { EXPLOSION_FRAMES, loadSprites } from "./sprites";
import {
  drawShapeBall,
  drawShapeBlock,
  drawShapeExplosion,
  drawShapePaddle,
  loadSkin,
  nextSkin,
  saveSkin,
  SKINS,
} from "./skins";
import { collideBlocks, createBlocks, type Ball, type Block } from "./utils";
import type { GameEngineFactory, GameStats } from "../../lib/games/types";

export type Phase =
  "ready" | "playing" | "clearing" | "levelclear" | "won" | "gameover";

export type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number; // ms
};

export type Paddle = { x: number; y: number; w: number; h: number };

export type ArkanoidState = {
  phase: Phase;
  level: number; // 1..LEVELS.length
  score: number;
  lives: number;
  paddle: Paddle;
  ball: Ball;
  blocks: Block[];
  explosions: Explosion[];
};

export type SoundName = "bounce" | "break";

// Núcleo de reglas: estado en el cierre, sin DOM, sin teclado, sin bucle.
// `createArkanoidGame` (bucle, entrada, dibujo y ciclo de vida) lo envuelve.
export function createArkanoidCore(playSound: (name: SoundName) => void) {
  const state: ArkanoidState = {
    phase: "ready",
    level: 1,
    score: 0,
    lives: CFG.lives,
    paddle: {
      x: (W - CFG.paddle.w) / 2,
      y: CFG.paddle.y,
      w: CFG.paddle.w,
      h: CFG.paddle.h,
    },
    ball: { x: 0, y: 0, vx: 0, vy: 0, size: CFG.ball.size },
    blocks: [],
    explosions: [],
  };

  const keys = { left: false, right: false };

  function clampPaddle() {
    const p = state.paddle;
    p.x = Math.max(0, Math.min(W - p.w, p.x));
  }

  function stickBallToPaddle() {
    const p = state.paddle;
    const b = state.ball;
    b.x = p.x + p.w / 2 - b.size / 2;
    b.y = p.y - b.size;
    b.vx = 0;
    b.vy = 0;
  }

  function reset() {
    state.level = 1;
    state.score = 0;
    state.lives = CFG.lives;
    state.blocks = createBlocks(state.level);
    state.explosions = [];
    state.paddle.x = (W - state.paddle.w) / 2;
    state.phase = "ready";
    stickBallToPaddle();
  }

  function nextLevel() {
    state.level++;
    state.blocks = createBlocks(state.level);
    state.explosions = [];
    state.phase = "ready";
    stickBallToPaddle();
  }

  function launchBall() {
    if (state.phase !== "ready") return;
    const b = state.ball;
    const angle = Math.PI / 4;
    const speed = LEVELS[state.level - 1].ballSpeed;
    b.vx = speed * Math.cos(angle);
    b.vy = -speed * Math.sin(angle);
    state.phase = "playing";
  }

  function setKey(key: "left" | "right", down: boolean) {
    keys[key] = down;
  }

  function releaseKeys() {
    keys.left = false;
    keys.right = false;
  }

  function update(dt: number) {
    const p = state.paddle;
    if (keys.left) p.x -= CFG.paddle.speed * dt;
    if (keys.right) p.x += CFG.paddle.speed * dt;
    clampPaddle();

    // Explosiones: avanzan en todas las fases y se eliminan al terminar
    for (const ex of state.explosions) ex.elapsed += dt * 1000;
    state.explosions = state.explosions.filter(
      (ex) => ex.elapsed < EXPLOSION_DURATION,
    );

    if (state.phase === "clearing" && state.explosions.length === 0) {
      if (state.level < LEVELS.length) {
        state.phase = "levelclear";
        state.lives = Math.min(CFG.maxLives, state.lives + 1);
      } else {
        state.phase = "won";
      }
    }

    const b = state.ball;
    if (state.phase === "ready") {
      stickBallToPaddle();
      return;
    }
    if (state.phase !== "playing") return;

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Paredes laterales
    if (b.x < 0) {
      b.x = 0;
      b.vx = -b.vx;
      playSound("bounce");
    } else if (b.x + b.size > W) {
      b.x = W - b.size;
      b.vx = -b.vx;
      playSound("bounce");
    }
    // Techo
    if (b.y < 0) {
      b.y = 0;
      b.vy = -b.vy;
      playSound("bounce");
    }

    const hit = collideBlocks(b, state.blocks, state.level);
    if (hit.kind === "bounce") {
      playSound("bounce");
    } else if (hit.kind === "break") {
      const blk = hit.block;
      playSound("break");
      state.explosions.push({
        x: blk.x,
        y: blk.y,
        w: blk.w,
        h: blk.h,
        color: blk.color,
        elapsed: 0,
      });
      state.score += hit.points;
    }

    // Último bloque roto: se espera a que acaben las explosiones
    if (state.blocks.every((blk) => !blk.alive)) {
      state.phase = "clearing";
      b.vx = 0;
      b.vy = 0;
      return;
    }

    // Pala: solo si la bola baja, para no rebotar dos veces seguidas
    if (
      b.vy > 0 &&
      b.x + b.size > p.x &&
      b.x < p.x + p.w &&
      b.y + b.size > p.y &&
      b.y < p.y + p.h
    ) {
      b.y = p.y - b.size;
      b.vy = -b.vy;
      playSound("bounce");
    }

    // Caída por abajo
    if (b.y > H) {
      state.lives--;
      state.phase = state.lives <= 0 ? "gameover" : "ready";
      stickBallToPaddle();
    }
  }

  // Fin de partida pedido desde fuera (FIN): GAME OVER con 0 vidas
  function forceGameOver() {
    state.phase = "gameover";
    state.lives = 0;
    state.ball.vx = 0;
    state.ball.vy = 0;
    releaseKeys();
  }

  reset();

  return {
    state,
    reset,
    forceGameOver,
    nextLevel,
    launchBall,
    setKey,
    releaseKeys,
    update,
  };
}

export type ArkanoidCore = ReturnType<typeof createArkanoidCore>;

const SOUND_URLS: Record<SoundName, string> = {
  bounce: "/games/arkanoid/sounds/ball-bounce.mp3",
  break: "/games/arkanoid/sounds/break-sound.mp3",
};

// Teclas que no deben capturarse cuando el foco está en un campo de texto o un botón
function isIgnoredTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON";
}

export const createArkanoidGame: GameEngineFactory = (canvas, events) => {
  let destroyed = false;
  let paused = false;
  let gameOver = false; // onGameOver se llama una sola vez por partida
  let rafId = 0;
  let lastTime = 0;
  let lastStats: GameStats | null = null;

  // Audio: un elemento por sonido; se clona para permitir sonidos solapados
  // y se ignora el rechazo de play() (autoplay bloqueado)
  const audio = {} as Record<SoundName, HTMLAudioElement>;
  for (const name of Object.keys(SOUND_URLS) as SoundName[]) {
    const a = new Audio(SOUND_URLS[name]);
    a.preload = "auto";
    audio[name] = a;
  }
  function playSound(name: SoundName) {
    if (destroyed) return;
    const p = (audio[name].cloneNode() as HTMLAudioElement).play();
    if (p) p.catch(() => {});
  }

  const core = createArkanoidCore(playSound);
  const sprites = loadSprites(
    () => {},
    () => destroyed,
  );

  const ctx = canvas.getContext("2d");
  let skin = loadSkin();

  function currentStats(): GameStats {
    const { score, lives, level } = core.state;
    return { score, lives, level };
  }

  // Solo emite cuando cambia algún valor
  function emitStats() {
    const s = currentStats();
    const l = lastStats;
    if (l && l.score === s.score && l.lives === s.lives && l.level === s.level)
      return;
    lastStats = s;
    events.onStats(s);
  }

  // Único punto de salida: derrota, victoria y end()
  function finish() {
    if (gameOver) return;
    gameOver = true;
    events.onGameOver(currentStats());
  }

  function drawOverlay(title: string, hint?: string) {
    if (!ctx) return;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = skin.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 48px monospace";
    ctx.fillText(title, W / 2, hint ? H / 2 - 20 : H / 2);
    if (hint) {
      ctx.font = "20px monospace";
      ctx.fillText(hint, W / 2, H / 2 + 30);
    }
  }

  function draw() {
    if (!ctx) return;
    const { state } = core;
    const p = state.paddle;
    const b = state.ball;
    ctx.fillStyle = skin.bg;
    ctx.fillRect(0, 0, W, H);

    for (const blk of state.blocks) {
      if (!blk.alive) continue;
      if (!skin.sprites) {
        drawShapeBlock(ctx, skin, blk.color, blk.x, blk.y, blk.w, blk.h);
      } else {
        sprites.drawSprite(
          ctx,
          `block_${blk.color}`,
          blk.x,
          blk.y,
          blk.w,
          blk.h,
        );
      }
    }
    for (const ex of state.explosions) {
      if (!skin.sprites) {
        const t = Math.min(1, ex.elapsed / EXPLOSION_DURATION);
        drawShapeExplosion(ctx, skin, ex.color, ex.x, ex.y, ex.w, ex.h, t);
        continue;
      }
      const i = Math.min(3, Math.floor(ex.elapsed / (EXPLOSION_DURATION / 4)));
      sprites.drawFrame(
        ctx,
        EXPLOSION_FRAMES[ex.color][i],
        ex.x,
        ex.y,
        ex.w,
        ex.h,
      );
    }
    if (skin.sprites) {
      sprites.drawSprite(ctx, "paddle", p.x, p.y, p.w, p.h);
      sprites.drawSprite(ctx, "ball", b.x, b.y, b.size, b.size);
    } else {
      drawShapePaddle(ctx, skin, p.x, p.y, p.w, p.h);
      drawShapeBall(ctx, skin, b.x, b.y, b.size);
    }

    // HUD
    ctx.fillStyle = skin.text;
    ctx.font = "20px monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(`Puntos: ${state.score}`, 16, 16);
    ctx.textAlign = "center";
    ctx.fillText(`Nivel ${state.level}`, W / 2, 16);
    ctx.textAlign = "right";
    ctx.fillText(`Vidas: ${state.lives}`, W - 16, 16);
    ctx.fillStyle = skin.textDim;
    ctx.font = "12px monospace";
    ctx.textBaseline = "bottom";
    ctx.fillText(`SKIN ${skin.name.toUpperCase()}`, W - 14, H - 6);

    if (state.phase === "levelclear") {
      drawOverlay(
        `Nivel ${state.level} completado`,
        "Pulsa Enter o Espacio para continuar",
      );
    } else if (state.phase === "won" || state.phase === "gameover") {
      drawOverlay(
        state.phase === "won" ? "Has ganado" : "Game over",
        "Pulsa Enter o Espacio para reiniciar",
      );
    }
    if (paused) drawOverlay("PAUSA");
  }

  function setPaused(value: boolean) {
    if (paused === value) return;
    paused = value;
    lastTime = performance.now(); // evita el salto de dt al reanudar
  }

  function onKeyDown(e: KeyboardEvent) {
    if (isIgnoredTarget(e.target)) return;
    if (e.code === "ArrowLeft") {
      core.setKey("left", true);
      e.preventDefault();
    }
    if (e.code === "ArrowRight") {
      core.setKey("right", true);
      e.preventDefault();
    }
    if (e.code === "Space") e.preventDefault();
    if (e.repeat) return;

    const phase = core.state.phase;
    const ended = phase === "won" || phase === "gameover";

    if (e.code === "KeyP") {
      if (ended) return;
      setPaused(!paused);
      events.onPauseChange?.(paused);
      return;
    }
    if (paused) return;

    if (e.code === "KeyS") {
      // Cambia de skin (también con la partida terminada; no en pausa)
      skin = SKINS[nextSkin(skin.id)];
      saveSkin(skin.id);
      draw();
      return;
    }

    const confirm = e.code === "Enter" || e.code === "Space";
    if (ended && confirm) {
      // onRestart antes que onStats: el HUD de React vuelve a initialLives
      events.onRestart();
      core.reset();
      gameOver = false;
      emitStats();
    } else if (phase === "levelclear" && confirm) {
      core.nextLevel();
      emitStats();
    } else if (e.code === "Space") core.launchBall();
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code === "ArrowLeft") core.setKey("left", false);
    if (e.code === "ArrowRight") core.setKey("right", false);
  }

  function frame(now: number) {
    if (destroyed) return;
    const dt = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;
    if (!paused) {
      core.update(dt);
      emitStats();
      const phase = core.state.phase;
      if (phase === "won" || phase === "gameover") finish();
    }
    draw();
    rafId = requestAnimationFrame(frame);
  }

  function startLoop() {
    cancelAnimationFrame(rafId);
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return {
    start() {
      core.reset();
      paused = false;
      gameOver = false;
      lastStats = null;
      emitStats();
      startLoop();
    },
    pause() {
      setPaused(true);
    },
    resume() {
      setPaused(false);
    },
    restart() {
      core.reset();
      core.releaseKeys();
      paused = false;
      gameOver = false;
      lastTime = performance.now();
      emitStats();
    },
    end() {
      if (gameOver) return;
      core.forceGameOver();
      emitStats();
      finish();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      core.releaseKeys();
    },
  };
};
