import { Chess } from 'chess.js'
import { EngineError } from '@/lib/engine/errors'
import type { GameActionContext, ServerGame } from '@/lib/engine/server/contracts'
import { chessManifest } from './manifest'
import type { ChessAction, ChessColorChoice, ChessGameState, ChessGameView } from './model'
import { playerColor } from './model'

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

function reduce(state: ChessGameState, rawAction: unknown, context: GameActionContext): ChessGameState {
  if (!rawAction || typeof rawAction !== 'object' || !('type' in rawAction)) invalid('Action must include a type')
  const action = rawAction as ChessAction

  if (action.type === 'chess.start') {
    if (context.actorId !== context.hostId) invalid('Only the room host can start the game')
    if (state.phase !== 'lobby') invalid('Game has already started')
    const colors = assignedColors(action.hostColor, context)
    return { ...createState(), ...colors, phase: 'active' }
  }

  if (action.type === 'chess.move') {
    if (state.phase !== 'active') invalid('Game is not active')
    const chess = new Chess(state.fen)
    const actorColor = playerColor(state, context.actorId)
    if (!actorColor) invalid('You are not seated in this game')
    if (chess.turn() !== actorColor) invalid(chess.turn() === 'w' ? 'White to move' : 'Black to move')
    try {
      chess.move({ from: action.from, to: action.to, promotion: action.promotion ?? 'q' })
    } catch {
      invalid('Illegal chess move')
    }
    const result = gameResult(chess)
    return {
      ...state,
      phase: result ? 'finished' : 'active',
      fen: chess.fen(),
      pgn: chess.pgn(),
      result,
      lastMove: { from: action.from, to: action.to },
    }
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
    return { ...createState(), phase: 'active', whiteId: state.whiteId, blackId: state.blackId }
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
