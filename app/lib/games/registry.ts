import { createArkanoidGame } from "../../games/arkanoid/engine";
import { createAsteroidsGame } from "../../games/asteroids/engine";
import { createTetrisGame } from "../../games/tetris/engine";
import type { GameEngineFactory } from "./types";

export type GameDefinition = {
  factory: GameEngineFactory;
  width: number; // resolución interna del canvas
  height: number;
  controls: string; // línea bajo .crt-bottom
  initialLives: number; // vidas del HUD tras reiniciar
};

// Motores reales por id de juego. Los juegos que no están aquí siguen con la
// simulación de GamePlayer. `Partial` hace que `ENGINES[id]` pueda ser
// `undefined` sin necesidad de un cast.
export const ENGINES: Partial<Record<string, GameDefinition>> = {
  asteroids: {
    factory: createAsteroidsGame,
    width: 800,
    height: 600,
    controls: "← → ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR · ↓ ESCUDO · P PAUSA",
    initialLives: 3,
  },
  tetris: {
    factory: createTetrisGame,
    width: 800,
    height: 600,
    controls:
      "← → MOVER · ↑ X ROTAR · ↓ BAJAR · ESPACIO CAER · G FANTASMA · S SKIN · P PAUSA",
    initialLives: 1,
  },
  arkanoid: {
    factory: createArkanoidGame,
    width: 800,
    height: 600,
    controls: "← → MOVER · ESPACIO LANZAR · ENTER CONTINUAR · P PAUSA",
    initialLives: 3,
  },
};
