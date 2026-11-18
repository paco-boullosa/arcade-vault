export type GameStats = {
  score: number;
  lives: number; // 0 al terminar
  level: number; // empieza en 1
};

export type GameEngineEvents = {
  onStats: (stats: GameStats) => void; // solo cuando cambia algún valor
  onGameOver: (finalStats: GameStats) => void; // una vez por partida
  onRestart: () => void; // el jugador reinició desde el propio juego (Espacio)
  onPauseChange?: (paused: boolean) => void; // el jugador pausó o reanudó con la tecla P
};

export interface GameEngine {
  start(): void; // empieza una partida nueva y arranca el bucle
  pause(): void;
  resume(): void;
  restart(): void; // partida nueva desde cero (no emite onRestart; solo lo emite el reinicio con Espacio)
  end(): void; // termina la partida actual: muestra GAME OVER en el canvas y emite onGameOver
  destroy(): void; // detiene el bucle y quita todos los listeners
}

export type GameEngineFactory = (
  canvas: HTMLCanvasElement,
  events: GameEngineEvents,
) => GameEngine;
