import { cacheLife } from "next/cache";
import { createClient } from "../lib/supabase/public";
import { formatPlays } from "../lib/format";
import type { Tables } from "../lib/supabase/database.types";

export type GameColor = "cyan" | "magenta" | "yellow" | "green";
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: GameColor;
  best: number;
  plays: string;
};

type GameStatsRow = Tables<"games_with_stats">;

// Las vistas no declaran nulabilidad: las columnas salen como `| null` aunque
// vengan de columnas `not null` (o de coalesce/count). Se estrechan aquí.
function toGame(row: GameStatsRow): Game {
  return {
    id: row.id!,
    title: row.title!,
    short: row.short!,
    long: row.long!,
    cat: row.cat as GameCategory,
    cover: row.cover!,
    color: row.color as GameColor,
    best: row.best ?? 0,
    plays: formatPlays(row.plays ?? 0),
  };
}

export async function getGames(): Promise<Game[]> {
  "use cache";
  cacheLife("seconds");
  const { data, error } = await createClient()
    .from("games_with_stats")
    .select("*")
    .order("sort_order");

  if (error) throw new Error(`No se pudo cargar el catálogo: ${error.message}`);
  return data.map(toGame);
}

export async function getGame(id: string): Promise<Game | undefined> {
  "use cache";
  cacheLife("seconds");
  const { data, error } = await createClient()
    .from("games_with_stats")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`No se pudo cargar el juego: ${error.message}`);
  return data ? toGame(data) : undefined;
}
