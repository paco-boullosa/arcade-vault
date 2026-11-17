import type { Metadata } from "next";
import { getGames } from "./data/games";
import { getRecentScores, getTopPlayers } from "./data/activity";
import HomeView from "./components/HomeView";

export const metadata: Metadata = {
  title: "Arcade Vault · Inicio",
};

export default async function Home() {
  const [games, recent, top] = await Promise.all([
    getGames(),
    getRecentScores(),
    getTopPlayers(),
  ]);
  return <HomeView games={games.slice(0, 6)} recent={recent} top={top} />;
}
