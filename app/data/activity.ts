import { createClient } from "../lib/supabase/public";
import { timeAgo } from "../lib/format";

export type NeonColor = "cyan" | "magenta" | "yellow" | "green";

export type RecentScore = {
  player: string;
  game: string;
  score: number;
  ago: string;
  color: NeonColor;
};

export type TopPlayer = { rank: number; player: string; score: number };

// Últimas 7 puntuaciones guardadas (todas las partidas, no solo la mejor de
// cada jugador), la más reciente primero.
export async function getRecentScores(): Promise<RecentScore[]> {
  const { data, error } = await createClient()
    .from("scores")
    .select("player_name, score, created_at, games(title, color)")
    .order("created_at", { ascending: false })
    .limit(7);

  if (error) {
    throw new Error(`No se pudo cargar la actividad: ${error.message}`);
  }

  // `games` es una relación muchos-a-uno obligatoria (clave foránea not null).
  return data.map((r) => ({
    player: r.player_name,
    game: r.games!.title,
    score: r.score,
    ago: timeAgo(r.created_at),
    color: r.games!.color as NeonColor,
  }));
}

// Top 5: mejor puntuación individual de cada nombre en cualquier juego.
export async function getTopPlayers(): Promise<TopPlayer[]> {
  const { data, error } = await createClient()
    .from("top_players")
    .select("player_name, score")
    .order("score", { ascending: false })
    .order("player_name", { ascending: true })
    .limit(5);

  if (error) {
    throw new Error(`No se pudo cargar el top de jugadores: ${error.message}`);
  }

  // Las vistas no declaran nulabilidad: se estrechan aquí.
  return data.map((r, i) => ({
    rank: i + 1,
    player: r.player_name!,
    score: r.score!,
  }));
}
