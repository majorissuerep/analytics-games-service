import { chessServerGame } from '@/games/chess/server'
import { EngineError } from '@/lib/engine/errors'
import type { ServerGame } from './contracts'

const SERVER_GAMES: Record<string, ServerGame<unknown, unknown>> = {
  [chessServerGame.manifest.id]: chessServerGame as ServerGame<unknown, unknown>,
}
export function getServerGame(gameId: string): ServerGame<unknown, unknown> {
  const game = SERVER_GAMES[gameId]
  if (!game) throw new EngineError('GAME_NOT_FOUND', `Unknown game: ${gameId}`, 404)
  return game
}
