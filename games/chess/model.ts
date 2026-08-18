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
  /** Selected time-control id, or null when no control has been chosen yet. */
  timeControlId: string | null
  /**
   * Remaining time on each clock, in milliseconds, at the moment the current
   * side-to-move's clock started ticking. The clock that should be running is
   * `chess.turn()`; the other player's clock is frozen at this value.
   */
  whiteClockMs: number
  blackClockMs: number
  /**
   * Epoch millisecond timestamp at which the current side-to-move's clock was
   * last started (game start, or just after the previous move). Clients use
   * this with `Date.now()` to render a live countdown and to claim a timeout.
   */
  clockStartedAtMs: number
}

export type ChessGameView = ChessGameState

export type ChessAction =
  | { type: 'chess.start'; hostColor: ChessColorChoice; timeControlId?: string }
  | { type: 'chess.move'; from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' }
  | { type: 'chess.resign' }
  | { type: 'chess.timeout' }
  | { type: 'chess.rematch' }

export function playerColor(state: ChessGameState, playerId: string): Color | null {
  if (state.whiteId === playerId) return 'w'
  if (state.blackId === playerId) return 'b'
  return null
}

/** True when at least one side has no time control selected yet. */
export function hasTimeControl(state: ChessGameState): boolean {
  return Boolean(state.timeControlId)
}