import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { descriptorFromDiff, outcomeInfo, pinnedSquares, resultFor } from './chess-logic'

describe('chess-logic: pinnedSquares', () => {
  it('detects a piece pinned to the king by a rook', () => {
    // White king e1, white rook e2 shielding against a black rook e8 — all on the e-file.
    const fen = '4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1'
    expect(pinnedSquares(new Chess(fen)).has('e2')).toBe(true)
  })

  it('returns empty for the starting position', () => {
    expect(pinnedSquares(new Chess()).size).toBe(0)
  })

  it('does not flag pieces when the opponent is pinned', () => {
    // Black has the only pin (rook on a8 vs white king), but it is white to move,
    // so only white pieces are considered and none are pinned.
    const fen = 'r3k3/8/8/8/8/8/8/4K3 w - - 0 1'
    expect(pinnedSquares(new Chess(fen)).size).toBe(0)
  })
})

describe('chess-logic: descriptorFromDiff', () => {
  it('flags a capture', () => {
    const prev = new Chess()
    prev.move('e4')
    prev.move('d5')
    const next = new Chess(prev.fen())
    next.move('exd5')
    const descriptor = descriptorFromDiff(prev.fen(), next.fen())
    expect(descriptor.capture).toBe(true)
    expect(descriptor.checkmate).toBe(false)
    expect(descriptor.draw).toBe(false)
  })

  it('flags castling', () => {
    const prev = new Chess('r3kbnr/pppb1ppp/1qn1p3/3p4/3P4/2N1PN2/PPPB1PPP/R3K2R w KQkq - 0 1')
    const next = new Chess(prev.fen())
    next.move('O-O')
    expect(descriptorFromDiff(prev.fen(), next.fen()).castle).toBe(true)
  })

  it('flags a quiet move as neither capture nor check', () => {
    const prev = new Chess()
    const next = new Chess(prev.fen())
    next.move('e4')
    const descriptor = descriptorFromDiff(prev.fen(), next.fen())
    expect(descriptor.capture).toBe(false)
    expect(descriptor.check).toBe(false)
    expect(descriptor.castle).toBe(false)
  })
})

describe('chess-logic: outcomeInfo', () => {
  it('win when the perspective matches the winner', () => {
    const info = outcomeInfo('White wins by checkmate', 'w')
    expect(info.kind).toBe('win')
    expect(info.headline).toBe('You win!')
    expect(info.reason).toBe('White wins by checkmate')
  })

  it('loss when the opponent wins', () => {
    const info = outcomeInfo('White wins by checkmate', 'b')
    expect(info.kind).toBe('loss')
    expect(info.headline).toBe('You lose')
  })

  it('draw for a draw result regardless of perspective', () => {
    const info = outcomeInfo('Draw by stalemate', 'w')
    expect(info.kind).toBe('draw')
    expect(info.headline).toBe('Draw')
  })

  it('info (no winner) when there is no perspective', () => {
    const info = outcomeInfo('Black wins by resignation', null)
    expect(info.kind).toBe('info')
    expect(info.headline).toBe('Black wins')
  })
})

describe('chess-logic: resultFor', () => {
  it('detects checkmate', () => {
    const g = new Chess()
    g.move('f3')
    g.move('e5')
    g.move('g4')
    g.move('Qh4')
    expect(g.isCheckmate()).toBe(true)
    expect(resultFor(g)).toBe('Black wins by checkmate')
  })

  it('returns empty for an unfinished game', () => {
    expect(resultFor(new Chess())).toBe('')
  })
})
