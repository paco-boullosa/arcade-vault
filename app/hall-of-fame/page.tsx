import type { Metadata } from "next";
import { getGames } from "../data/games";
import { getScores } from "../data/scores";
import HallOfFameView from "../components/HallOfFameView";

export const metadata: Metadata = {
  title: "Arcade Vault · Salón de la Fama",
};

export default async function HallOfFamePage() {
  const games = await getGames();
  const entries = await Promise.all(
    games.map(async (game) => ({
      game,
      rows: await getScores(game.id, 12),
    })),
  );
  return <HallOfFameView entries={entries} />;
}
