import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { applyUci, formatCp, formatMoveLoss, lineQualityColor, moveQualityColor, presentAnalysis } from './reckless-presentation'
import type { RecklessAnalysis } from './reckless'

const START_FEN = new Chess().fen()

function legalMoveSet(fen = START_FEN): Set<string> {
  return new Set(new Chess(fen).moves({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ''}`))
}

describe('moveQualityColor', () => {
  it('makes best green, keeps the first tenth greenish, and saturates red at half a pawn', () => {
    expect(moveQualityColor(0)).toBe('rgb(29, 118, 65)')
    expect(moveQualityColor(10)).toBe('rgb(70, 125, 64)')
    expect(moveQualityColor(25)).toBe('rgb(143, 102, 27)')
    expect(moveQualityColor(50)).toBe('rgb(181, 48, 44)')
    expect(moveQualityColor(5000)).toBe(moveQualityColor(50))
    expect(moveQualityColor(-1)).toBe(moveQualityColor(0))
    expect(moveQualityColor(null)).toBe('rgb(112, 123, 132)')
    expect(moveQualityColor(NaN)).toBe(moveQualityColor(null))
    expect(moveQualityColor(50, .24)).toBe('rgba(181, 48, 44, 0.24)')
    const channels = (color: string) => color.match(/\d+/g)!.map(Number)
    const a = channels(moveQualityColor(1)), b = channels(moveQualityColor(2))
    expect(a.every((value, i) => Math.abs(value - b[i]) <= 5)).toBe(true)
    expect(moveQualityColor(2)).not.toBe(moveQualityColor(0))
  })
})

describe('formatCp', () => {
  it('formats pawns with explicit sign', () => {
    expect(formatCp(42)).toBe('+0.42')
    expect(formatCp(-130)).toBe('−1.30')
    expect(formatCp(0)).toBe('0.00')
  })
})

describe('applyUci', () => {
  it('applies legal moves and rejects illegal ones', () => {
    expect(applyUci(START_FEN, 'e2e4')).toMatch(/rnbqkbnr\/pppppppp\/8\/8\/4P3/)
    expect(applyUci(START_FEN, 'e2e5')).toBeNull()
    expect(applyUci(START_FEN, 'banana')).toBeNull()
  })
})

describe('presentAnalysis', () => {
  it('adds SAN, deltas versus best, and balance from White perspective', () => {
    const analysis: RecklessAnalysis = {
      bestMove: 'd2d4',
      lines: [
        { multipv: 1, uci: 'd2d4', scoreCp: 41, mateIn: null, bounded: false, depth: 18, pv: ['d2d4', 'd7d5'] },
        { multipv: 2, uci: 'c2c4', scoreCp: 23, mateIn: null, bounded: false, depth: 18, pv: ['c2c4'] },
      ],
    }
    const presented = presentAnalysis(START_FEN, 'w', analysis, legalMoveSet())
    expect(presented.balanceCp).toBe(41)
    expect(presented.balanceLabel).toBe('White +0.41')
    expect(presented.lines[0]).toMatchObject({ san: 'd4', deltaCp: 0, scoreLabel: '+0.41', pvSan: ['d4', 'd5'], pvComplete: true })
    expect(presented.lines[1]).toMatchObject({ san: 'c4', deltaCp: 18 })
  })

  it('flips balance sign for Black to move', () => {
    const analysis: RecklessAnalysis = {
      bestMove: 'g8f6',
      lines: [{ multipv: 1, uci: 'b8c6', scoreCp: 30, mateIn: null, bounded: false, depth: 10, pv: ['b8c6'] }],
    }
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    const presented = presentAnalysis(fen, 'b', analysis, legalMoveSet(fen))
    expect(presented.balanceCp).toBe(-30)
    expect(presented.balanceLabel).toBe('Black +0.30')
  })

  it('drops illegal moves and truncates principal variations at hallucinated moves', () => {
    const analysis: RecklessAnalysis = {
      bestMove: 'e2e4',
      lines: [
        { multipv: 1, uci: 'e2e4', scoreCp: 30, mateIn: null, bounded: false, depth: 9, pv: ['e2e4', 'zz9z'] },
        { multipv: 2, uci: 'e2e5', scoreCp: 99, mateIn: null, bounded: false, depth: 9, pv: ['e2e5'] },
      ],
    }
    const presented = presentAnalysis(START_FEN, 'w', analysis, legalMoveSet())
    expect(presented.lines).toHaveLength(1)
    expect(presented.lines[0].pvSan).toEqual(['e4'])
    expect(presented.lines[0].pvComplete).toBe(false)
  })

  it('reports mate labels and null balance for mate lines', () => {
    const analysis: RecklessAnalysis = {
      bestMove: 'e2e4',
      lines: [{ multipv: 1, uci: 'e2e4', scoreCp: null, mateIn: 2, bounded: false, depth: 30, pv: ['e2e4'] }],
    }
    const presented = presentAnalysis(START_FEN, 'w', analysis, legalMoveSet())
    expect(presented.balanceCp).toBeNull()
    expect(presented.balanceLabel).toBe('White mates in 2')
    expect(presented.lines[0].scoreLabel).toBe('#2')
  })
})


describe('analysis consistency', () => {
  it('sorts by absolute evaluation and deduplicates moves instead of trusting stale ranks', () => {
    const line = (uci: string, cp: number, rank: number) => ({ multipv: rank, uci, scoreCp: cp, mateIn: null, bounded: false, depth: 12, pv: [uci] })
    const result = presentAnalysis(START_FEN, 'w', { bestMove: 'e2e4', lines: [line('e2e4', 20, 1), line('d2d4', 55, 2), line('e2e4', 20, 3)] }, legalMoveSet())
    expect(result.lines.map(line => line.uci)).toEqual(['d2d4', 'e2e4'])
    expect(result.lines.map(line => line.deltaCp)).toEqual([0, 35])
  })
  it('names the winning side correctly for a negative mate score', () => {
    const line = { multipv: 1, uci: 'e2e4', scoreCp: null, mateIn: -3, bounded: false, depth: 12, pv: ['e2e4'] }
    expect(presentAnalysis(START_FEN, 'w', { bestMove: 'e2e4', lines: [line] }, legalMoveSet()).balanceLabel).toBe('Black mates in 3')
  })

  it.each([-1000, -30, 0, 300, 2000])('normalizes best to zero and keeps a fixed loss scale at position score %i', (best) => {
    const moves = ['e2e4', 'd2d4', 'c2c4', 'g1f3', 'b1c3']
    const losses = [0, 2, 10, 50, 90]
    const lines = moves.map((uci, i) => ({ multipv: i + 1, uci, scoreCp: best - losses[i], mateIn: null, bounded: false, depth: 12, pv: [uci] }))
    const result = presentAnalysis(START_FEN, 'w', { bestMove: 'e2e4', lines: [...lines].reverse() }, legalMoveSet())
    expect(result.lines.map(line => line.deltaCp)).toEqual(losses)
    expect(result.lines.map(formatMoveLoss)).toEqual(['0.00', '−0.02', '−0.10', '−0.50', '−0.90'])
    expect(lineQualityColor(result.lines[0])).toBe('rgb(29, 118, 65)')
    expect(lineQualityColor(result.lines[3])).toBe('rgb(181, 48, 44)')
    expect(lineQualityColor(result.lines[4])).toBe('rgb(181, 48, 44)')
  })

  it('reproduces the black-to-move screenshot without confusing White balance with move loss', () => {
    const fen = new Chess().move('e4').after
    const moves = ['e7e6', 'e7e5', 'c7c5', 'g8f6', 'b8c6']
    const scores = [-30, -32, -42, -44, -80]
    const lines = moves.map((uci, i) => ({ multipv: i + 1, uci, scoreCp: scores[i], mateIn: null, bounded: false, depth: 12, pv: [uci] }))
    const result = presentAnalysis(fen, 'b', { bestMove: 'e7e6', lines }, legalMoveSet(fen))
    expect(result.balanceLabel).toBe('White +0.30')
    expect(result.lines.map(formatMoveLoss)).toEqual(['0.00', '−0.02', '−0.12', '−0.14', '−0.50'])
    expect(result.lines[0].scoreLabel).toBe('−0.30')
    expect(lineQualityColor(result.lines[0])).toBe(moveQualityColor(0))
  })

  it('honors the engine choice among tied best moves and does not stretch colors with candidate count', () => {
    const line = (uci: string, cp: number) => ({ multipv: 1, uci, scoreCp: cp, mateIn: null, bounded: false, depth: 12, pv: [uci] })
    const lines = [line('d2d4', 20), line('e2e4', 20), line('c2c4', 10)]
    const result = presentAnalysis(START_FEN, 'w', { bestMove: 'e2e4', lines }, legalMoveSet())
    expect(result.lines.map(line => line.uci)).toEqual(['e2e4', 'd2d4', 'c2c4'])
    expect(result.lines.map(line => line.deltaCp)).toEqual([0, 0, 10])
    expect(result.lines.map(line => lineQualityColor(line))).toEqual([moveQualityColor(0), moveQualityColor(0), moveQualityColor(10)])
  })

  it('uses the freshest duplicate score and keeps bounds incomparable rather than inventing a gain', () => {
    const line = (uci: string, cp: number, depth: number, bounded = false) => ({ multipv: 1, uci, scoreCp: cp, mateIn: null, bounded, depth, pv: [uci] })
    const result = presentAnalysis(START_FEN, 'w', { bestMove: 'e2e4', lines: [line('e2e4', 100, 8), line('e2e4', -10, 12), line('d2d4', 20, 12), line('c2c4', 999, 13, true)] }, legalMoveSet())
    expect(result.lines.map(line => line.uci)).toEqual(['d2d4', 'e2e4', 'c2c4'])
    expect(result.lines.map(line => line.deltaCp)).toEqual([0, 30, null])
    expect(formatMoveLoss(result.lines[2])).toBe('uncertain')
    expect(lineQualityColor(result.lines[2])).toBe(moveQualityColor(null))
  })

  it('ranks mates correctly without pretending that a mate-distance change is a pawn loss', () => {
    const mate = (uci: string, mateIn: number | null, scoreCp: number | null = null) => ({ multipv: 1, uci, scoreCp, mateIn, bounded: false, depth: 20, pv: [uci] })
    const wins = presentAnalysis(START_FEN, 'w', { bestMove: 'e2e4', lines: [mate('g1f3', null, 200000), mate('d2d4', 5), mate('e2e4', 3)] }, legalMoveSet())
    expect(wins.lines.map(line => line.uci)).toEqual(['e2e4', 'd2d4', 'g1f3'])
    expect(wins.lines.map(formatMoveLoss)).toEqual(['0.00', 'slower mate', 'misses mate'])
    expect(lineQualityColor(wins.lines[0])).toBe(moveQualityColor(0))
    expect(lineQualityColor(wins.lines[2])).toBe(moveQualityColor(50))
    const losses = presentAnalysis(START_FEN, 'w', { bestMove: 'e2e4', lines: [mate('e2e4', -3), mate('d2d4', -7)] }, legalMoveSet())
    expect(losses.lines.map(line => line.uci)).toEqual(['d2d4', 'e2e4'])
    expect(losses.lines.map(formatMoveLoss)).toEqual(['0.00', 'mated sooner'])
    expect(lineQualityColor(losses.lines[0])).toBe(moveQualityColor(0))
    expect(lineQualityColor(losses.lines[1])).toBe(moveQualityColor(50))
    const allowed = presentAnalysis(START_FEN, 'w', { bestMove: 'e2e4', lines: [mate('e2e4', null, -500), mate('d2d4', -2)] }, legalMoveSet())
    expect(formatMoveLoss(allowed.lines[1])).toBe('allows mate')
    expect(allowed.lines[1].deltaCp).toBeNull()
  })
})
