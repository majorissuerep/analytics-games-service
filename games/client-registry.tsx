'use client'

import { ConsensusRadarGame } from './consensus-radar/client/ConsensusRadarGame'
import { MinefieldGame } from './minefield/client/MinefieldGame'
import { PaintboxGame } from './paintbox/client/PaintboxGame'

interface GameClientProps {
  gameId: string
}
const CLIENT_GAMES: Record<string, React.ComponentType> = {
  'consensus-radar': ConsensusRadarGame,
  minefield: MinefieldGame,
  paintbox: PaintboxGame,
}

export function GameClient({ gameId }: GameClientProps) {
  const Component = CLIENT_GAMES[gameId]
  if (!Component) return null
  return <Component />
}
