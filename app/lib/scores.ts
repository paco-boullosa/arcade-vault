import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";
import type { PlayerBest } from "../data/scores";
import { formatDate } from "./format";

// Mejor marca de un jugador (por nombre exacto) en un juego, con su rango:
// 1 + el número de jugadores del juego con una puntuación mayor.
export async function fetchPlayerBest(
  supabase: SupabaseClient<Database>,
  gameId: string,
  name: string,
): Promise<PlayerBest | null> {
  const { data: mine, error } = await supabase
    .from("game_best_scores")
    .select("score, created_at")
    .eq("game_id", gameId)
    .eq("player_name", name)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!mine || mine.score === null || mine.created_at === null) return null;

  const { count, error: countError } = await supabase
    .from("game_best_scores")
    .select("*", { count: "exact", head: true })
    .eq("game_id", gameId)
    .gt("score", mine.score);

  if (countError) throw new Error(countError.message);

  return {
    rank: 1 + (count ?? 0),
    score: mine.score,
    date: formatDate(mine.created_at),
  };
}
