import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { applyUci, formatCp, heatColor, presentAnalysis } from './reckless-presentation'
import type { RecklessAnalysis } from './reckless'

const START_FEN = new Chess().fen()

function legalMoveSet(fen = START_FEN): Set<string> {
  return new Set(new Chess(fen).moves({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ''}`))
}

describe('heatColor', () => {
  it('maps rank 0 to green, last rank to red, and the middle to warm tones', () => {
    expect(heatColor(0, 20)).toBe('rgb(46, 158, 79)')
    expect(heatColor(19, 20)).toBe('rgb(198, 56, 46)')
    expect(heatColor(0, 1)).toBe('rgb(46, 158, 79)')
    const channels = (color: string) => color.replace(/[^0-9, ]/g, '').split(',').map((value) => Number(value.trim()))
    for (const rank of [9, 13]) {
      const [r, g] = channels(heatColor(rank, 20))
      expect(r).toBeGreaterThan(180)
      expect(g).toBeLessThan(198)
    }
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
