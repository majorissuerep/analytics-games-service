'use client'

import { ChessGame } from './chess/client/ChessGame'
import { ConsensusRadarGame } from './consensus-radar/client/ConsensusRadarGame'
import { MinefieldGame } from './minefield/client/MinefieldGame'
import { PaintboxGame } from './paintbox/client/PaintboxGame'
import { PinballGame } from './orbit-pinball/client/PinballGame'

interface GameClientProps {
  gameId: string
}
const CLIENT_GAMES: Record<string, React.ComponentType> = {
  chess: ChessGame,
  'consensus-radar': ConsensusRadarGame,
  minefield: MinefieldGame,
  'orbit-pinball': PinballGame,
  paintbox: PaintboxGame,
}

export function GameClient({ gameId }: GameClientProps) {
  const Component = CLIENT_GAMES[gameId]
  if (!Component) return null
  return <Component />
}
