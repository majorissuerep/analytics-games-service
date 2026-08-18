import { Chess, type Color, type Square } from 'chess.js'

export const FILE_NAMES = 'abcdefgh'

/** Convert a chess.js board index (row=rank from 8, col=file from a) to a square name. */
export function squareAt(row: number, col: number): Square {
  return `${FILE_NAMES[col]}${8 - row}` as Square
}

export function kingSquare(chess: Chess, color: Color): Square | null {
  for (let row = 0; row < 8; row += 1) {
    const rank = chess.board()[row]
    for (let col = 0; col < 8; col += 1) {
      const cell = rank[col]
      if (cell && cell.type === 'k' && cell.color === color) return squareAt(row, col)
    }
  }
  return null
}

export function countPieces(chess: Chess): number {
  let total = 0
  for (const rank of chess.board()) for (const cell of rank) if (cell) total += 1
  return total
}

/**
 * Squares occupied by pieces of the side to move that are pinned to their king
 * (they shield an enemy slider line). A pinned piece cannot legally leave the
 * pin line, so it is highlighted to make that constraint obvious.
 */
export function pinnedSquares(chess: Chess): Set<Square> {
  const pinned = new Set<Square>()
  const board = chess.board()
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const cell = board[row][col]
      if (!cell || cell.type === 'k' || cell.color !== chess.turn()) continue
      const probe = new Chess(chess.fen())
      probe.remove(squareAt(row, col))
      if (probe.inCheck()) pinned.add(squareAt(row, col))
    }
  }
  return pinned
}

export interface MoveTransition {
  capture: boolean
  check: boolean
  checkmate: boolean
  draw: boolean
  castle: boolean
}

/**
 * Infer what happened in a single board transition purely from the two FEN
 * strings. Used to fire the right sound for a move no matter which code path
 * applied it (local, bot engine, or an online opponent via polling).
 */
export function descriptorFromDiff(prevFen: string, nextFen: string): MoveTransition {
  const prev = new Chess(prevFen)
  const next = new Chess(nextFen)
  const mover = prev.turn()
  const capture = countPieces(prev) > countPieces(next)
  const prevKing = kingSquare(prev, mover)
  const nextKing = kingSquare(next, mover)
  const castle = Boolean(
    prevKing &&
    nextKing &&
    Math.abs(nextKing.charCodeAt(0) - prevKing.charCodeAt(0)) === 2 &&
    prevKing[1] === nextKing[1],
  )
  return {
    capture,
    check: next.inCheck(),
    checkmate: next.isCheckmate(),
    draw: next.isStalemate() || next.isThreefoldRepetition() || next.isInsufficientMaterial(),
    castle,
  }
}

export type GameOverInfo = { kind: 'win' | 'loss' | 'draw' | 'info'; headline: string; reason: string }

export function outcomeInfo(result: string, perspective: Color | null): GameOverInfo {
  const lower = result.toLowerCase()
  const whiteWins = lower.startsWith('white wins')
  const blackWins = lower.startsWith('black wins')
  const winner: Color | null = whiteWins ? 'w' : blackWins ? 'b' : null
  if (!winner) return { kind: 'draw', headline: 'Draw', reason: result }
  if (!perspective) return { kind: 'info', headline: whiteWins ? 'White wins' : 'Black wins', reason: result }
  if (winner === perspective) return { kind: 'win', headline: 'You win!', reason: result }
  return { kind: 'loss', headline: 'You lose', reason: result }
}

/** Result strings matching the server resultFor format. */
export function resultFor(chess: Chess) {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate'
  if (chess.isStalemate()) return 'Draw by stalemate'
  if (chess.isThreefoldRepetition()) return 'Draw by repetition'
  if (chess.isInsufficientMaterial()) return 'Draw by insufficient material'
  if (chess.isDraw()) return 'Draw'
  return ''
}