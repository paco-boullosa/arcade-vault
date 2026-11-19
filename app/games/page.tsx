import { Suspense } from "react";
import type { Metadata } from "next";
import { getGames } from "../data/games";
import LibraryView from "../components/LibraryView";

export const metadata: Metadata = {
  title: "Arcade Vault · Biblioteca",
};

async function LibraryContent() {
  const games = await getGames();
  return <LibraryView games={games} />;
}

export default function GamesPage() {
  return (
    <Suspense fallback={<p>CARGANDO…</p>}>
      <LibraryContent />
    </Suspense>
  );
}
