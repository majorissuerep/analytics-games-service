import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { StandaloneGameFrame } from '@/components/desktop/StandaloneGameFrame'
import { getPlatformGame } from '@/lib/platform/catalog'
import { GameClient } from '@/games/client-registry'

interface GamePageProps {
  params: Promise<{ gameId: string }>
}

export async function generateMetadata({ params }: GamePageProps): Promise<Metadata> {
  const { gameId } = await params
  const game = await getPlatformGame(gameId)
  if (!game) return {}
  return {
    title: game.title,
    description: game.description,
  }
}

export default async function GamePage({ params }: GamePageProps) {
  const { gameId } = await params
  const game = await getPlatformGame(gameId)
  if (!game || game.status === 'coming-soon') notFound()
  if (game.integration.kind === 'external') return <StandaloneGameFrame game={game} />
  return <GameClient gameId={game.id} />
}
