import { describe, expect, it } from 'vitest'
import { collectRecklessLines, parseRecklessInfoLine } from './reckless'

describe('parseRecklessInfoLine', () => {
  it('parses a complete multipv info line', () => {
    const line = 'info depth 18 seldepth 35 multipv 2 score cp 23 nodes 7205808 time 810 nps 8885791 hashfull 695 tbhits 0 pv c2c4 e7e5 g2g3'
    expect(parseRecklessInfoLine(line)).toEqual({
      multipv: 2,
      uci: 'c2c4',
      scoreCp: 23,
      mateIn: null,
      bounded: false,
      depth: 18,
      pv: ['c2c4', 'e7e5', 'g2g3'],
    })
  })

  it('parses mate scores and upperbound flags', () => {
    const parsed = parseRecklessInfoLine('info depth 19 multipv 1 score mate 3 upperbound pv e2e4')
    expect(parsed).toMatchObject({ scoreCp: null, mateIn: 3, bounded: true, uci: 'e2e4' })
    const negative = parseRecklessInfoLine('info depth 12 multipv 1 score mate -2 pv a1a2')
    expect(negative).toMatchObject({ mateIn: -2 })
  })

  it('rejects non-info lines and lines without pv', () => {
    expect(parseRecklessInfoLine('bestmove d2d4')).toBeNull()
    expect(parseRecklessInfoLine('info depth 10 score cp 20')).toBeNull()
    expect(parseRecklessInfoLine('info depth 10 score cp 20 pv nonsense')).toBeNull()
  })
})

describe('collectRecklessLines', () => {
  it('keeps the last complete line per multipv index, sorted', () => {
    const lines = collectRecklessLines([
      'info depth 8 multipv 1 score cp 30 pv d2d4',
      'info depth 9 multipv 1 score cp 33 pv e2e4',
      'info depth 8 multipv 2 score cp 20 pv c2c4',
      'info depth 9 multipv 2 score cp 24 pv g1f3',
    ])
    expect(lines.map((line) => [line.multipv, line.uci, line.scoreCp])).toEqual([
      [1, 'e2e4', 33],
      [2, 'g1f3', 24],
    ])
  })

  it('falls back to a bound-flagged line only when the index has nothing else', () => {
    const lines = collectRecklessLines([
      'info depth 19 multipv 1 score cp 33 upperbound pv e2e4',
      'info depth 18 multipv 2 score cp 32 pv c2c4',
      'info depth 19 multipv 2 score cp 32 pv c2c4 b8c6',
    ])
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ multipv: 1, bounded: true, uci: 'e2e4' })
    expect(lines[1]).toMatchObject({ multipv: 2, bounded: false, depth: 19 })
  })
})
