import type {
  GameEngine,
  GameEngineEvents,
  GameStats,
} from "../../lib/games/types";
import {
  H,
  MAX_DT,
  POINTS,
  POWERUP_WINDOW,
  SAFE_DIST,
  SHIELD_DURATION,
  SHIELD_GRACE,
  SHIELD_RADIUS,
  TRIPLE_DURATION,
  W,
} from "./constants";
import {
  Asteroid,
  Bullet,
  Particle,
  PowerUp,
  Ship,
  type KeyState,
} from "./entities";
import { dist, rand, randInt } from "./utils";

const GAME_KEYS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

// Los eventos de teclado que nacen en estos elementos no son del juego
// (por ejemplo, escribir un nombre con espacios en el modal).
function isIgnoredTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON";
}

// Todo el estado vive en este cierre: se pueden crear y destruir varias
// instancias sin globales.
export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  events: GameEngineEvents,
): GameEngine {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D no disponible");
  const ctx: CanvasRenderingContext2D = context;
  canvas.width = W;
  canvas.height = H;

  // ── Entrada ─────────────────────────────────────────────────────────────────
  const keys: KeyState = {};
  const justPressed: KeyState = {};

  const onKeyDown = (e: KeyboardEvent) => {
    if (isIgnoredTarget(e.target)) return;
    if (e.code === "KeyP") {
      if (!e.repeat) togglePause(true);
      return;
    }
    justPressed[e.code] = !keys[e.code];
    keys[e.code] = true;
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };

  // Consulta de un solo uso: true una vez por pulsación.
  const pressed = (code: string): boolean => {
    const val = !!justPressed[code];
    justPressed[code] = false;
    return val;
  };

  // ── Estado del juego ────────────────────────────────────────────────────────
  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerUp: PowerUp | null = null;
  let powerUpSpawned = false; // ya apareció en este nivel
  let levelKills = 0; // asteroides destruidos en el nivel actual
  let powerUpKillTarget = 1; // destrucción en la que aparecerá el ítem
  let tripleShotTimer = 0; // s restantes de disparo triple
  let shieldTimer = 0; // s restantes de escudo activo (0 = inactivo)
  let shieldAvailable = true; // queda el escudo de esta vida
  let score = 0;
  let lives = 3;
  let level = 1;
  let state: "playing" | "dead" | "gameover" = "playing";
  let deadTimer = 0;
  let paused = false;
  let gameOverEmitted = false; // onGameOver se emite una sola vez por partida
  // Últimos valores notificados: onStats solo se emite cuando alguno cambia.
  let lastStats: GameStats | null = null;

  let rafId: number | null = null;
  let lastTime: number | null = null;
  let destroyed = false;

  function spawnAsteroids(count: number) {
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  // Prepara el ítem del nivel: un nivel con N asteroides grandes tiene N*7
  // destrucciones (1 grande → 2 medianos → 4 pequeños). Se elige en cuál
  // aparece, sin llegar al final.
  function resetLevelPowerUp(count: number) {
    powerUp = null;
    powerUpSpawned = false;
    levelKills = 0;
    powerUpKillTarget = randInt(1, Math.floor(count * 7 * POWERUP_WINDOW));
  }

  // Emite onStats solo si cambia score, lives o level (o si se fuerza).
  function emitStats(force = false) {
    if (
      !force &&
      lastStats &&
      lastStats.score === score &&
      lastStats.lives === lives &&
      lastStats.level === level
    ) {
      return;
    }
    lastStats = { score, lives, level };
    events.onStats({ ...lastStats });
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    gameOverEmitted = false;
    tripleShotTimer = 0;
    shieldTimer = 0;
    shieldAvailable = true;
    resetLevelPowerUp(4);
    spawnAsteroids(4);
    emitStats(true);
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    ship.reset();
    resetLevelPowerUp(3 + level);
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  // Destruye un asteroide (puntos, explosión, power-up) y devuelve sus
  // fragmentos.
  function destroyAsteroid(a: Asteroid): Asteroid[] {
    a.dead = true;
    score += POINTS[a.size];
    explode(a.x, a.y, a.size * 5);
    // Disparo Triple: una vez por nivel, en una destrucción aleatoria
    levelKills++;
    if (!powerUpSpawned && levelKills >= powerUpKillTarget) {
      powerUp = new PowerUp(a.x, a.y);
      powerUpSpawned = true;
    }
    return a.split();
  }

  // Pasa a GAME OVER y avisa a React una sola vez por partida.
  function finishGame() {
    state = "gameover";
    if (gameOverEmitted) return;
    gameOverEmitted = true;
    emitStats();
    events.onGameOver({ score, lives, level });
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    tripleShotTimer = 0;
    shieldTimer = 0;
    lives--;
    if (lives <= 0) {
      finishGame();
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state === "gameover") {
      if (pressed("Space")) {
        initGame();
        events.onRestart();
        return;
      }
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      pressed("ArrowDown"); // descartar pulsaciones mientras se está muerto
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (powerUp) {
        powerUp.update(dt);
        if (powerUp.dead) powerUp = null;
      }
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
        shieldAvailable = true;
      }
      return;
    }

    // Disparar
    if (pressed("Space")) {
      bullets.push(...ship.tryShoot(tripleShotTimer > 0));
    }

    // Activar escudo (uno por vida)
    if (pressed("ArrowDown") && shieldAvailable && !ship.dead) {
      shieldTimer = SHIELD_DURATION;
      shieldAvailable = false;
    }

    ship.update(dt, keys);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    if (tripleShotTimer > 0)
      tripleShotTimer = Math.max(0, tripleShotTimer - dt);
    if (shieldTimer > 0) shieldTimer = Math.max(0, shieldTimer - dt);
    if (powerUp) {
      powerUp.update(dt);
      if (powerUp.dead) powerUp = null;
    }

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          newAsteroids.push(...destroyAsteroid(a));
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Recoger power-up
    if (
      powerUp &&
      !ship.dead &&
      dist(ship, powerUp) < ship.radius + powerUp.radius
    ) {
      tripleShotTimer = TRIPLE_DURATION;
      explode(powerUp.x, powerUp.y, 10);
      powerUp = null;
    }

    // Nave vs asteroide
    if (shieldTimer > 0) {
      // Escudo: absorbe el primer asteroide que toque su círculo
      for (const a of asteroids) {
        if (dist(ship, a) < SHIELD_RADIUS + a.radius * 0.82) {
          const frags = destroyAsteroid(a);
          asteroids = asteroids.filter((x) => !x.dead).concat(frags);
          shieldTimer = 0;
          ship.invincible = SHIELD_GRACE;
          break;
        }
      }
    } else if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (asteroids.length === 0) nextLevel();
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  function drawLifeIcon(x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawHUD() {
    ctx.fillStyle = "#fff";
    ctx.font = "15px monospace";

    ctx.textAlign = "left";
    ctx.fillText(`SCORE  ${score}`, 14, 26);

    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${level}`, W / 2, 26);

    for (let i = 0; i < lives; i++) drawLifeIcon(W - 16 - i * 22, 18);

    if (tripleShotTimer > 0) {
      ctx.textAlign = "left";
      ctx.fillStyle = "#0ff";
      ctx.fillText(`TRIPLE  ${Math.ceil(tripleShotTimer)}s`, 14, 46);
    }

    const shieldY = tripleShotTimer > 0 ? 66 : 46;
    if (shieldTimer > 0) {
      ctx.textAlign = "left";
      ctx.fillStyle = "rgb(80,180,255)";
      ctx.fillText(`ESCUDO  ${Math.ceil(shieldTimer)}s`, 14, shieldY);
    } else if (shieldAvailable) {
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(80,180,255,0.55)";
      ctx.fillText("ESCUDO  [↓]", 14, shieldY);
    }
  }

  function drawOverlay(title: string, sub?: string) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 46px monospace";
    ctx.fillText(title, W / 2, H / 2 - 18);
    if (sub) {
      ctx.font = "18px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillText(sub, W / 2, H / 2 + 22);
    }
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw(ctx));
    asteroids.forEach((a) => a.draw(ctx));
    if (powerUp) powerUp.draw(ctx);
    bullets.forEach((b) => b.draw(ctx));
    ship.draw(ctx);
    ship.drawShield(ctx, shieldTimer);

    drawHUD();

    if (state === "gameover") {
      drawOverlay(
        "GAME OVER",
        `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`,
      );
    } else if (paused) {
      drawOverlay("PAUSA", "P PARA CONTINUAR");
    }
  }

  // ── Bucle principal ─────────────────────────────────────────────────────────
  function loop(ts: number) {
    if (destroyed) return;
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    if (!paused) update(dt);
    emitStats();
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (destroyed || rafId !== null) return;
    initGame();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  }

  function destroy() {
    destroyed = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  }

  // ── Ciclo de vida ───────────────────────────────────────────────────────────
  // Descarta pulsaciones pendientes para que no se disparen al reanudar.
  function clearPressed() {
    for (const code of Object.keys(justPressed)) justPressed[code] = false;
  }

  function pause() {
    if (destroyed || paused || state === "gameover") return;
    paused = true;
    clearPressed();
  }

  function resume() {
    if (destroyed || !paused) return;
    paused = false;
    clearPressed();
    lastTime = null; // evita un salto de tiempo tras la pausa
  }

  // Pausa con la tecla P: avisa a React para sincronizar el botón.
  function togglePause(notify: boolean) {
    if (state === "gameover") return;
    if (paused) resume();
    else pause();
    if (notify) events.onPauseChange?.(paused);
  }

  // Partida nueva desde cero. No emite onRestart (solo lo hace Espacio).
  function restart() {
    if (destroyed) return;
    paused = false;
    clearPressed();
    lastTime = null;
    initGame(); // emite onStats
  }

  // Termina la partida actual: GAME OVER en el canvas y onGameOver.
  function end() {
    if (destroyed || state === "gameover") return;
    paused = false;
    if (!ship.dead) {
      explode(ship.x, ship.y, 14);
      ship.dead = true;
    }
    tripleShotTimer = 0;
    shieldTimer = 0;
    lives = 0;
    finishGame();
  }

  return { start, pause, resume, restart, end, destroy };
}
