"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Game } from "../data/games";
import type { PlayerBest, ScoreRow } from "../data/scores";
import { createClient } from "../lib/supabase/client";
import { fetchPlayerBest } from "../lib/scores";
import { useSession } from "./SessionProvider";

type Entry = { game: Game; rows: ScoreRow[] };

const fmt = (n: number) => n.toLocaleString("es-ES");

export default function HallOfFameView({ entries }: { entries: Entry[] }) {
  const { user } = useSession();
  const [tab, setTab] = useState(entries[0].game.id);

  const { game, rows } = entries.find((e) => e.game.id === tab) ?? entries[0];
  const [first, second, third] = rows;

  // Resultado de la consulta de "tu mejor marca", etiquetado con la pestaña y el
  // nombre a los que corresponde. Si no coincide con los actuales, está cargando
  // (o falló) y no se muestra nada.
  const userName = user?.name ?? null;
  const supabase = useMemo(() => createClient(), []);
  const [best, setBest] = useState<{
    key: string;
    value: PlayerBest | null;
  } | null>(null);

  useEffect(() => {
    if (!userName) return;
    let cancelled = false;
    fetchPlayerBest(supabase, tab, userName)
      .then((value) => {
        if (!cancelled) setBest({ key: `${tab}|${userName}`, value });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [supabase, tab, userName]);

  const youBest =
    userName && best?.key === `${tab}|${userName}` ? best : null;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {entries.map(({ game: g }) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p
          className="pixel"
          style={{
            fontSize: 12,
            textAlign: "center",
            padding: "48px 16px",
            letterSpacing: "0.1em",
            color: "var(--ink-faint)",
          }}
        >
          AÚN NO HAY PUNTUACIONES
        </p>
      ) : (
        <>
          <div className="podium">
            <div className="podium-slot silver">
              <div className="rank-num">02</div>
              <div className="name">{second?.name ?? "—"}</div>
              <div className="score">{second ? fmt(second.score) : "—"}</div>
              <div className="date">{second?.date ?? "—"}</div>
            </div>
            <div className="podium-slot gold">
              <div
                className="pixel"
                style={{
                  fontSize: 9,
                  color: "var(--gold)",
                  letterSpacing: "0.18em",
                }}
              >
                CAMPEÓN
              </div>
              <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
                01
              </div>
              <div className="name">{first.name}</div>
              <div className="score" style={{ fontSize: 20 }}>
                {fmt(first.score)}
              </div>
              <div className="date">{first.date}</div>
            </div>
            <div className="podium-slot bronze">
              <div className="rank-num">03</div>
              <div className="name">{third?.name ?? "—"}</div>
              <div className="score">{third ? fmt(third.score) : "—"}</div>
              <div className="date">{third?.date ?? "—"}</div>
            </div>
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.name + i}
                className={
                  "tr" +
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{fmt(r.score)}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {userName && youBest && (
        <div
          className="hall-table"
          style={{ marginTop: rows.length > 0 ? 16 : 0 }}
        >
          {youBest.value ? (
            <>
              <div className="tr you-label">
                ▸ TU MEJOR MARCA EN {game.title}
              </div>
              <div className="tr you">
                <div className="rk" style={{ color: "var(--yellow)" }}>
                  #{String(youBest.value.rank).padStart(2, "0")}
                </div>
                <div className="pl" style={{ color: "var(--yellow)" }}>
                  {userName}
                </div>
                <div
                  className="sc"
                  style={{
                    color: "var(--yellow)",
                    textShadow: "0 0 6px rgba(245,255,0,0.5)",
                  }}
                >
                  {fmt(youBest.value.score)}
                </div>
                <div className="dt">{youBest.value.date}</div>
              </div>
            </>
          ) : (
            <div className="tr you-label">
              ▸ AÚN NO TIENES MARCA EN {game.title}
            </div>
          )}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/games" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
