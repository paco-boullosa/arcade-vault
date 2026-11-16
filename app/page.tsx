import type { Metadata } from "next";
import { getGames } from "./data/games";
import LibraryView from "./components/LibraryView";

export const metadata: Metadata = {
  title: "Arcade Vault · Biblioteca",
};

export default async function Home() {
  const games = await getGames();
  return <LibraryView games={games} />;
}
