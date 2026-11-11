import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { applyUci, formatCp, heatColor, presentAnalysis } from './reckless-presentation'
import type { RecklessAnalysis } from './reckless'

const START_FEN = new Chess().fen()

function legalMoveSet(fen = START_FEN): Set<string> {
  return new Set(new Chess(fen).moves({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ''}`))
}

describe('heatColor', () => {
  it('uses stable absolute scores with similar colors for similar evaluations', () => {
    expect(heatColor(0)).toBe('rgb(112, 123, 132)')
    expect(heatColor(300)).toBe('rgb(34, 132, 77)')
    expect(heatColor(-300)).toBe('rgb(181, 60, 52)')
    expect(heatColor(900)).toBe(heatColor(300))
    expect(heatColor(null, 3)).toBe(heatColor(300))
    expect(heatColor(null, -3)).toBe(heatColor(-300))
    const channels = (color: string) => color.match(/\d+/g)!.map(Number)
    const a = channels(heatColor(40)), b = channels(heatColor(45))
    expect(a.every((value, i) => Math.abs(value - b[i]) < 4)).toBe(true)
    expect(heatColor(40)).not.toBe(heatColor(-200))
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
})
