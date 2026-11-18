import { createAsteroidsGame } from "../../games/asteroids/engine";
import type { GameEngineFactory } from "./types";

// Motores reales por id de juego. Los juegos que no están aquí siguen con la
// simulación de GamePlayer.
export const ENGINES: Record<string, GameEngineFactory> = {
  asteroids: createAsteroidsGame,
};
