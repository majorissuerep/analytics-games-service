import { Chess } from 'chess.js'
import { EngineError } from '@/lib/engine/errors'
import type { GameActionContext, ServerGame } from '@/lib/engine/server/contracts'
import { chessManifest } from './manifest'
import type { ChessAction, ChessColorChoice, ChessGameState, ChessGameView } from './model'
import { playerColor } from './model'
import { chessTimeControl as resolveTimeControl } from './time-control'

function invalid(message: string): never {
  throw new EngineError('INVALID_ACTION', message, 400)
}

function createState(): ChessGameState {
  const chess = new Chess()
  return {
    phase: 'lobby',
    fen: chess.fen(),
    pgn: '',
    whiteId: null,
    blackId: null,
    result: '',
    lastMove: null,
    timeControlId: null,
    whiteClockMs: 0,
    blackClockMs: 0,
    clockStartedAtMs: 0,
  }
}

function assignedColors(choice: ChessColorChoice, context: GameActionContext) {
  const guest = context.players.find((player) => player.id !== context.hostId)
  if (!guest) invalid('A second player must join before the game starts')
  const hostIsWhite = choice === 'white' || (choice === 'random' && context.random.int(0, 1) === 0)
  return hostIsWhite
    ? { whiteId: context.hostId, blackId: guest.id }
    : { whiteId: guest.id, blackId: context.hostId }
}

function gameResult(chess: Chess) {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate'
  if (chess.isStalemate()) return 'Draw by stalemate'
  if (chess.isThreefoldRepetition()) return 'Draw by repetition'
  if (chess.isInsufficientMaterial()) return 'Draw by insufficient material'
  if (chess.isDraw()) return 'Draw'
  return ''
}

/** Clock field for a given color. */
function clockFor(state: ChessGameState, color: 'w' | 'b'): number {
  return color === 'w' ? state.whiteClockMs : state.blackClockMs
}

/** Remaining time for the given color as of `nowMs`, given that the current
 * side-to-move's clock has been counting down since `clockStartedAtMs`. */
function remainingAt(state: ChessGameState, color: 'w' | 'b', nowMs: number): number {
  const stored = clockFor(state, color)
  if (color !== state.fen.split(' ')[1]) return stored
  return stored - Math.max(0, nowMs - state.clockStartedAtMs)
}

function reduce(state: ChessGameState, rawAction: unknown, context: GameActionContext): ChessGameState {
  if (!rawAction || typeof rawAction !== 'object' || !('type' in rawAction)) invalid('Action must include a type')
  const action = rawAction as ChessAction
  const nowMs = context.now.getTime()

  if (action.type === 'chess.start') {
    if (context.actorId !== context.hostId) invalid('Only the room host can start the game')
    if (state.phase !== 'lobby') invalid('Game has already started')
    const colors = assignedColors(action.hostColor, context)
    const control = resolveTimeControl(action.timeControlId)
    const baseMs = control.baseSeconds * 1000
    return {
      ...createState(),
      ...colors,
      phase: 'active',
      timeControlId: control.id,
      whiteClockMs: baseMs,
      blackClockMs: baseMs,
      clockStartedAtMs: nowMs,
    }
  }

  if (action.type === 'chess.move') {
    if (state.phase !== 'active') invalid('Game is not active')
    const chess = new Chess(state.fen)
    const actorColor = playerColor(state, context.actorId)
    if (!actorColor) invalid('You are not seated in this game')
    if (chess.turn() !== actorColor) invalid(chess.turn() === 'w' ? 'White to move' : 'Black to move')

    let next: Chess
    try {
      next = new Chess(state.fen)
      next.move({ from: action.from, to: action.to, promotion: action.promotion ?? 'q' })
    } catch {
      invalid('Illegal chess move')
    }

    // Settle the mover's clock: their flag may have fallen before the move.
    const elapsed = nowMs - state.clockStartedAtMs
    const remaining = clockFor(state, actorColor) - elapsed

    // A move that delivers checkmate stands even if the flag also fell
    // (FIDE 6.9). Any other terminal move result also takes priority.
    const moveResult = gameResult(next)
    if (moveResult) {
      return {
        ...state,
        phase: 'finished',
        fen: next.fen(),
        pgn: next.pgn(),
        result: moveResult,
        lastMove: { from: action.from, to: action.to },
      }
    }

    // The mover ran out of time before completing the move → loss on time
    // (or a draw if the opponent lacks mating material).
    if (remaining <= 0) {
      if (next.isInsufficientMaterial()) {
        return {
          ...state,
          phase: 'finished',
          fen: next.fen(),
          pgn: next.pgn(),
          result: 'Draw by insufficient material',
          lastMove: { from: action.from, to: action.to },
        }
      }
      const winner = actorColor === 'w' ? 'Black' : 'White'
      return {
        ...state,
        phase: 'finished',
        fen: next.fen(),
        pgn: next.pgn(),
        result: `${winner} wins on time`,
        lastMove: { from: action.from, to: action.to },
      }
    }

    const control = resolveTimeControl(state.timeControlId)
    return {
      ...state,
      phase: 'active',
      fen: next.fen(),
      pgn: next.pgn(),
      result: '',
      lastMove: { from: action.from, to: action.to },
      whiteClockMs: actorColor === 'w' ? remaining + control.incrementSeconds * 1000 : state.whiteClockMs,
      blackClockMs: actorColor === 'b' ? remaining + control.incrementSeconds * 1000 : state.blackClockMs,
      clockStartedAtMs: nowMs,
    }
  }

  if (action.type === 'chess.timeout') {
    if (state.phase !== 'active') invalid('Game is not active')
    const side = state.fen.split(' ')[1] as 'w' | 'b'
    const remaining = remainingAt(state, side, nowMs)
    if (remaining > 0) invalid('That player’s time has not yet expired')
    if (new Chess(state.fen).isInsufficientMaterial()) {
      return { ...state, phase: 'finished', result: 'Draw by insufficient material' }
    }
    const winner = side === 'w' ? 'Black' : 'White'
    return { ...state, phase: 'finished', result: `${winner} wins on time` }
  }

  if (action.type === 'chess.resign') {
    if (state.phase !== 'active') invalid('Game is not active')
    const color = playerColor(state, context.actorId)
    if (!color) invalid('You are not seated in this game')
    return { ...state, phase: 'finished', result: color === 'w' ? 'Black wins by resignation' : 'White wins by resignation' }
  }

  if (action.type === 'chess.rematch') {
    if (context.actorId !== context.hostId) invalid('Only the room host can start a rematch')
    if (state.phase !== 'finished') invalid('Finish the current game first')
    const control = resolveTimeControl(state.timeControlId)
    const baseMs = control.baseSeconds * 1000
    const nowMsRematch = context.now.getTime()
    return {
      ...createState(),
      phase: 'active',
      whiteId: state.whiteId,
      blackId: state.blackId,
      timeControlId: control.id,
      whiteClockMs: baseMs,
      blackClockMs: baseMs,
      clockStartedAtMs: nowMsRematch,
    }
  }

  invalid('Unsupported chess action')
}

export const chessServerGame: ServerGame<ChessGameState, ChessGameView> = {
  manifest: chessManifest,
  createState() {
    return createState()
  },
  reduce,
  project(state) {
    return state
  },
  leaderboardEntry(state, context) {
    const winner = state.result.startsWith('White wins') ? state.whiteId : state.result.startsWith('Black wins') ? state.blackId : null
    const player = context.players.find((candidate) => candidate.id === winner) ?? context.players[0]
    return { playerId: player?.id ?? 'unknown', name: player?.name ?? 'Unknown', score: winner ? 1 : 0, rounds: state.phase === 'finished' ? 1 : 0 }
  },
}