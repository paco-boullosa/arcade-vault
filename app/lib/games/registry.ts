import { createArkanoidGame } from "../../games/arkanoid/engine";
import { createAsteroidsGame } from "../../games/asteroids/engine";
import { createBanderasGame } from "../../games/banderas/engine";
import { createFroggerGame } from "../../games/frogger/engine";
import { createHorizonteGame } from "../../games/horizonte/engine";
import { createSnakeGame } from "../../games/snake/engine";
import { createTetrisGame } from "../../games/tetris/engine";
import type { GameEngineFactory } from "./types";

export type TouchButton = {
  code: string;
  label: string; // nombre completo: aria-label y fila fina
  short: string; // 3 letras en mayúsculas, dentro del botón circular
};

// Mando táctil de un juego. Los `code` son los `KeyboardEvent.code` que lee cada motor.
export type TouchConfig = {
  // false = el botón se muestra atenuado y no envía nada
  dpad: { up: boolean; down: boolean; left: boolean; right: boolean };
  a: TouchButton; // botón de acción principal
  b?: TouchButton; // si falta, se muestra atenuado y sin acción
  skin: string; // KeyboardEvent.code que cambia la skin del juego
  extras?: TouchButton[]; // botones extra de la fila fina
};

export type GameDefinition = {
  factory: GameEngineFactory;
  width: number; // resolución interna del canvas
  height: number;
  controls: string; // línea bajo .crt-bottom
  initialLives: number; // vidas del HUD tras reiniciar
  touch: TouchConfig;
};

// Motores reales por id de juego. Los juegos que no están aquí siguen con la
// simulación de GamePlayer. `Partial` hace que `ENGINES[id]` pueda ser
// `undefined` sin necesidad de un cast.
export const ENGINES: Partial<Record<string, GameDefinition>> = {
  asteroids: {
    factory: createAsteroidsGame,
    width: 800,
    height: 600,
    controls:
      "← → ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR · ↓ ESCUDO · S SKIN · P PAUSA",
    initialLives: 3,
    touch: {
      // ↓ es el escudo, que ya cubre el botón B.
      dpad: { up: true, down: false, left: true, right: true },
      a: { code: "Space", label: "DISPARAR", short: "FR" },
      b: { code: "ArrowDown", label: "ESCUDO", short: "SH" },
      skin: "KeyS",
    },
  },
  tetris: {
    factory: createTetrisGame,
    width: 800,
    height: 600,
    controls:
      "← → MOVER · ↑ X ROTAR · ↓ BAJAR · ESPACIO CAER · G FANTASMA · S SKIN · P PAUSA",
    initialLives: 1,
    touch: {
      dpad: { up: true, down: true, left: true, right: true },
      a: { code: "Space", label: "CAER", short: "CAE" },
      b: { code: "KeyX", label: "ROTAR", short: "ROT" },
      skin: "KeyS",
      extras: [
        { code: "KeyG", label: "FANTASMA", short: "GHOST" },
        { code: "KeyM", label: "MENÚ", short: "MENU" },
      ],
    },
  },
  arkanoid: {
    factory: createArkanoidGame,
    width: 800,
    height: 600,
    controls: "← → MOVER · ESPACIO LANZAR · ENTER CONTINUAR · P PAUSA · S SKIN",
    initialLives: 3,
    touch: {
      dpad: { up: false, down: false, left: true, right: true },
      a: { code: "Space", label: "LANZAR", short: "A" },
      skin: "KeyS",
    },
  },
  snake: {
    factory: createSnakeGame,
    width: 800,
    height: 600,
    controls:
      "← ↑ → ↓ / WASD MOVER · ESPACIO EMPEZAR/REINICIAR · P PAUSA · K SKIN",
    initialLives: 1,
    touch: {
      dpad: { up: true, down: true, left: true, right: true },
      a: { code: "Space", label: "EMPEZAR", short: "A" },
      skin: "KeyK",
    },
  },
  frogger: {
    factory: createFroggerGame,
    width: 800,
    height: 600,
    controls:
      "← ↑ → ↓ / WASD SALTAR · ESPACIO EMPEZAR/REINICIAR · P PAUSA · K SKIN",
    initialLives: 3,
    touch: {
      // Un toque = un salto: el motor ignora `e.repeat`, así que la repetición
      // de la cruz no encadena saltos. Sin B: no hay segunda acción.
      // S choca con WASD (abajo), por eso la skin es K, como en Snake.
      dpad: { up: true, down: true, left: true, right: true },
      a: { code: "Space", label: "EMPEZAR", short: "A" },
      skin: "KeyK",
    },
  },
  horizonte: {
    factory: createHorizonteGame,
    width: 800,
    height: 600,
    controls:
      "← ↑ → ↓ / WASD MOVER · ESPACIO DISPARAR/REINICIAR · P PAUSA · K SKIN",
    initialLives: 3,
    touch: {
      // Movimiento libre en 8 direcciones: la cruz mantiene la tecla (el motor
      // la lee con keydown/keyup y descarta las repeticiones). Dos direcciones a la
      // vez (multitáctil) dan diagonales. A mantenido = disparo automático.
      dpad: { up: true, down: true, left: true, right: true },
      a: { code: "Space", label: "DISPARAR", short: "DIS" },
      skin: "KeyK",
    },
  },
  banderas: {
    factory: createBanderasGame,
    width: 800,
    height: 600,
    controls:
      "← ↑ → ↓ / WASD CONDUCIR · ESPACIO EMPEZAR/REINICIAR · P PAUSA · K SKIN",
    initialLives: 3,
    touch: {
      // El coche se conduce manteniendo la cruz (el motor guarda las teclas
      // pulsadas y manda la última; ignora `repeat`). Espacio solo arranca o
      // reinicia, sin B ni extras. K cambia la skin (S es "abajo" en WASD).
      dpad: { up: true, down: true, left: true, right: true },
      a: { code: "Space", label: "EMPEZAR", short: "A" },
      skin: "KeyK",
    },
  },
};
