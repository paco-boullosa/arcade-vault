import { cacheLife } from "next/cache";
import { createClient } from "../lib/supabase/public";
import { formatDate } from "../lib/format";

export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string; // "DD/MM/YYYY"
};

export type PlayerBest = { rank: number; score: number; date: string };

// Ranking de un juego: una fila por jugador (su mejor marca), de mayor a menor
// puntuación. Empates: gana la más antigua.
export async function getScores(
  gameId: string,
  count: number,
): Promise<ScoreRow[]> {
  "use cache";
  cacheLife("seconds");
  const { data, error } = await createClient()
    .from("game_best_scores")
    .select("player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(count);

  if (error) {
    throw new Error(`No se pudo cargar el ranking: ${error.message}`);
  }

  // Las vistas no declaran nulabilidad: se estrechan aquí.
  return data.map((r, i) => ({
    rank: i + 1,
    name: r.player_name!,
    score: r.score!,
    date: formatDate(r.created_at!),
  }));
}
