'use client'

import { ConsensusRadarGame } from './consensus-radar/client/ConsensusRadarGame'

interface GameClientProps {
  gameId: string
}
const CLIENT_GAMES: Record<string, React.ComponentType> = {
  'consensus-radar': ConsensusRadarGame,
}

export function GameClient({ gameId }: GameClientProps) {
  const Component = CLIENT_GAMES[gameId]
  if (!Component) return null
  return <Component />
}
