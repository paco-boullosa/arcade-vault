import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getGame, getGames } from "../../../data/games";
import GamePlayer from "../../../components/GamePlayer";

export async function generateStaticParams() {
  const games = await getGames();
  return games.map((g) => ({ id: g.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/games/[id]/play">): Promise<Metadata> {
  const { id } = await params;
  const game = await getGame(id);
  return {
    title: game ? `Arcade Vault · Jugando a ${game.title}` : "Arcade Vault",
  };
}

async function Play({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();
  return <GamePlayer game={game} />;
}

export default function PlayPage({ params }: PageProps<"/games/[id]/play">) {
  return (
    <Suspense fallback={<div className="av-player" />}>
      <Play params={params} />
    </Suspense>
  );
}
