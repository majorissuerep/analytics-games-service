import type { Color, Square } from 'chess.js'

export type ChessPhase = 'lobby' | 'active' | 'finished'
export type ChessColorChoice = 'white' | 'black' | 'random'

export interface ChessGameState {
  phase: ChessPhase
  fen: string
  pgn: string
  whiteId: string | null
  blackId: string | null
  result: string
  lastMove: { from: Square; to: Square } | null
}

export type ChessGameView = ChessGameState

export type ChessAction =
  | { type: 'chess.start'; hostColor: ChessColorChoice }
  | { type: 'chess.move'; from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' }
  | { type: 'chess.resign' }
  | { type: 'chess.rematch' }

export function playerColor(state: ChessGameState, playerId: string): Color | null {
  if (state.whiteId === playerId) return 'w'
  if (state.blackId === playerId) return 'b'
  return null
}
