import { Chess } from 'chess.js'

export type ModelMatchMove = {
  ply: number
  uci: string
  san: string
  fen: string
  durationMs: number
  playedAt: string
}

export type ModelMatchState = {
  whiteRevisionId: string
  blackRevisionId: string
  status: 'active' | 'paused' | 'completed' | 'failed'
  turnBudgetMs: 3000
  fen: string
  pgn: string
  moves: ModelMatchMove[]
  result: string
  turnStartedAt: string
}

function resultFor(chess: Chess) {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? '0-1' : '1-0'
  if (chess.isDraw()) return '1/2-1/2'
  return ''
}

export function createModelMatchState(whiteRevisionId: string, blackRevisionId: string, now: Date): ModelMatchState {
  const chess = new Chess()
  return {
    whiteRevisionId,
    blackRevisionId,
    status: 'active',
    turnBudgetMs: 3000,
    fen: chess.fen(),
    pgn: '',
    moves: [],
    result: '',
    turnStartedAt: now.toISOString(),
  }
}

export function applyMatchMove(match: ModelMatchState, uci: string, durationMs: number, now: Date, expectedPly = match.moves.length): ModelMatchState {
  if (match.status === 'paused') throw new Error('Match is paused')
  if (match.status !== 'active') throw new Error('Match is not active')
  if (expectedPly !== match.moves.length) throw new Error('Match move is stale')
  if (!Number.isInteger(durationMs) || durationMs < 0 || durationMs > match.turnBudgetMs) throw new Error('Move exceeded turn budget')
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('Move is illegal')
  const chess = new Chess()
  for (const previous of match.moves) {
    chess.move({ from: previous.uci.slice(0, 2), to: previous.uci.slice(2, 4), promotion: previous.uci[4] || undefined })
  }
  let move
  try {
    move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined })
  } catch {
    throw new Error('Move is illegal')
  }
  const result = resultFor(chess)
  const snapshot: ModelMatchMove = {
    ply: match.moves.length + 1,
    uci,
    san: move.san,
    fen: chess.fen(),
    durationMs,
    playedAt: now.toISOString(),
  }
  return {
    ...match,
    status: result ? 'completed' : 'active',
    fen: snapshot.fen,
    pgn: chess.pgn(),
    moves: [...match.moves, snapshot],
    result,
    turnStartedAt: now.toISOString(),
  }
}

export function setMatchPaused(match: ModelMatchState, paused: boolean): ModelMatchState {
  if (match.status === 'completed' || match.status === 'failed') return match
  return { ...match, status: paused ? 'paused' : 'active', turnStartedAt: new Date().toISOString() }
}
