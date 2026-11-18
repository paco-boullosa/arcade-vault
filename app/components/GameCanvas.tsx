"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { H, W } from "../games/asteroids/constants";
import type {
  GameEngine,
  GameEngineEvents,
  GameEngineFactory,
  GameStats,
} from "../lib/games/types";

export type GameCanvasHandle = {
  end: () => void;
};

type Props = {
  factory: GameEngineFactory;
  paused: boolean;
  // Al cambiar, la partida se reinicia desde cero.
  runId: number;
  onStats: (stats: GameStats) => void;
  onGameOver: (finalStats: GameStats) => void;
  onRestart: () => void;
  onPauseChange?: (paused: boolean) => void;
  ref?: Ref<GameCanvasHandle>;
};

export default function GameCanvas({
  factory,
  paused,
  runId,
  onStats,
  onGameOver,
  onRestart,
  onPauseChange,
  ref,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const lastRunId = useRef(runId);

  // Los callbacks y `paused` viven en refs: que GamePlayer se vuelva a
  // renderizar con funciones nuevas no recrea el motor.
  const handlers = useRef<GameEngineEvents>({
    onStats,
    onGameOver,
    onRestart,
    onPauseChange,
  });
  const pausedRef = useRef(paused);
  useEffect(() => {
    handlers.current = { onStats, onGameOver, onRestart, onPauseChange };
    pausedRef.current = paused;
  });

  useImperativeHandle(ref, () => ({
    end: () => engineRef.current?.end(),
  }));

  // El motor se crea una vez por montaje (y por cambio de `factory`) y se
  // destruye al desmontar. StrictMode lo monta dos veces en desarrollo: el
  // `destroy()` del cleanup evita bucles y listeners duplicados.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = factory(canvas, {
      onStats: (s) => handlers.current.onStats(s),
      onGameOver: (s) => handlers.current.onGameOver(s),
      onRestart: () => handlers.current.onRestart(),
      onPauseChange: (p) => handlers.current.onPauseChange?.(p),
    });
    engineRef.current = engine;
    engine.start();
    if (pausedRef.current) engine.pause();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [factory]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (paused) engine.pause();
    else engine.resume();
  }, [paused]);

  useEffect(() => {
    if (lastRunId.current === runId) return;
    lastRunId.current = runId;
    engineRef.current?.restart();
  }, [runId]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{
        display: "block",
        width: "100%",
        aspectRatio: "4 / 3",
        background: "#000",
      }}
    />
  );
}
