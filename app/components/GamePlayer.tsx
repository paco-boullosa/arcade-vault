"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Game } from "../data/games";
import { ENGINES } from "../lib/games/registry";
import { createClient } from "../lib/supabase/client";
import type { TablesInsert } from "../lib/supabase/database.types";
import type { GameEngineFactory, GameStats } from "../lib/games/types";
import GameCanvas, { type GameCanvasHandle } from "./GameCanvas";
import { useSession } from "./SessionProvider";

type SaveStatus = "idle" | "saving" | "error";

const LIVES = 3;
const POINTS_PER_LEVEL = 2500;

export default function GamePlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user } = useSession();
  // Si el juego tiene motor real, se usa el canvas; si no, la simulación.
  const factory = ENGINES[game.id] as GameEngineFactory | undefined;
  const canvasHandle = useRef<GameCanvasHandle>(null);
  const [runId, setRunId] = useState(0);
  const [engineLives, setEngineLives] = useState(LIVES);
  const [engineLevel, setEngineLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  // `null` = sin editar: se muestra el usuario de la sesión (que se resuelve
  // tras montar) o INVITADO.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  // Evita que un doble clic envíe dos inserts antes de que se pinte `saving`.
  const savingRef = useRef(false);

  const name = nameDraft ?? user?.name ?? "INVITADO";
  const level = factory
    ? engineLevel
    : 1 + Math.floor(score / POINTS_PER_LEVEL);
  const lives = factory ? engineLives : LIVES;

  const resetStats = () => {
    setScore(0);
    setEngineLives(LIVES);
    setEngineLevel(1);
  };

  const restart = () => {
    resetStats();
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaveStatus("idle");
    setRunId((r) => r + 1);
  };

  // Notificaciones del motor
  const handleStats = (s: GameStats) => {
    setScore(s.score);
    setEngineLives(s.lives);
    setEngineLevel(s.level);
  };
  const handleGameOver = (final: GameStats) => {
    handleStats(final);
    setPaused(false);
    setOver(true);
  };
  // Reinicio con Espacio desde el propio juego: cierra el modal y pone el HUD a cero.
  const handleEngineRestart = () => {
    resetStats();
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaveStatus("idle");
  };

  // Los botones sueltan el foco tras pulsarse para que Espacio no los reactive.
  const togglePause = (e: MouseEvent<HTMLButtonElement>) => {
    setPaused((p) => !p);
    e.currentTarget.blur();
  };

  const finish = (e: MouseEvent<HTMLButtonElement>) => {
    if (factory) {
      // end() emite onGameOver, que abre el modal.
      canvasHandle.current?.end();
    } else {
      setOver(true);
    }
    e.currentTarget.blur();
  };

  const trimmedName = name.trim();

  const saveScore = async () => {
    if (savingRef.current || !trimmedName) return;
    savingRef.current = true;
    setSaveStatus("saving");

    const row: TablesInsert<"scores"> = {
      game_id: game.id,
      player_name: trimmedName,
      score,
    };
    try {
      const { error } = await createClient().from("scores").insert(row);
      if (error) throw error;
      setSaved(true);
      setSaveStatus("idle");
    } catch {
      setSaveStatus("error");
    } finally {
      savingRef.current = false;
    }
  };

  useEffect(() => {
    if (factory || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [factory, over, paused]);

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={finish}>
            FIN
          </button>
          <Link href={`/games/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {factory ? (
            <GameCanvas
              ref={canvasHandle}
              factory={factory}
              paused={paused}
              runId={runId}
              onStats={handleStats}
              onGameOver={handleGameOver}
              onRestart={handleEngineRestart}
              onPauseChange={setPaused}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {/* Con motor, la pausa se dibuja en el propio canvas. */}
          {paused && !factory && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
        {factory && (
          <div
            className="mono"
            style={{
              marginTop: 12,
              textAlign: "center",
              fontSize: 11,
              color: "var(--ink-dim)",
              letterSpacing: "0.12em",
            }}
          >
            ← → ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR · ↓ ESCUDO · P PAUSA
          </div>
        )}
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!factory ? (
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--ink-dim)",
                  letterSpacing: "0.12em",
                  margin: "12px 0",
                }}
              >
                ESTE JUEGO ES UNA DEMO: LA PUNTUACIÓN NO SE GUARDA
              </div>
            ) : !saved ? (
              <>
                <div className="input-row">
                  <input
                    value={name}
                    maxLength={16}
                    onChange={(e) =>
                      setNameDraft(e.target.value.toUpperCase().slice(0, 16))
                    }
                    placeholder="TUS INICIALES"
                  />
                  <button
                    className="btn yellow"
                    onClick={saveScore}
                    disabled={saveStatus === "saving" || !trimmedName}
                  >
                    {saveStatus === "saving"
                      ? "GUARDANDO…"
                      : saveStatus === "error"
                        ? "REINTENTAR"
                        : "GUARDAR PUNTUACIÓN"}
                  </button>
                </div>
                {saveStatus === "error" && (
                  <div
                    className="mono"
                    role="alert"
                    style={{
                      fontSize: 11,
                      color: "var(--magenta)",
                      letterSpacing: "0.12em",
                      marginTop: 8,
                    }}
                  >
                    NO SE PUDO GUARDAR LA PUNTUACIÓN. INTÉNTALO DE NUEVO.
                  </div>
                )}
              </>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button
                className="btn magenta"
                onClick={() => router.push("/games")}
              >
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
