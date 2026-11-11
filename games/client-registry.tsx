'use client'

import dynamic from 'next/dynamic'
import { LoadingState } from '@/components/ui/LoadingState'

interface GameClientProps {
  gameId: string
}
const CLIENT_GAMES: Record<string, React.ComponentType> = {
  chess: dynamic(() => import('./chess/client/ChessGame').then(module => module.ChessGame), { loading: () => <LoadingState scope="app" label="Opening Chess" /> }),
  minefield: dynamic(() => import('./minefield/client/MinefieldGame').then(module => module.MinefieldGame), { loading: () => <LoadingState scope="app" label="Opening Minefield" /> }),
  paintbox: dynamic(() => import('./paintbox/client/PaintboxGame').then(module => module.PaintboxGame), { loading: () => <LoadingState scope="app" label="Opening Paintbox" /> }),
}

export function GameClient({ gameId }: GameClientProps) {
  const Component = CLIENT_GAMES[gameId]
  if (!Component) return null
  return <Component />
}
