import { describe, expect, it } from 'vitest'
import { evaluationWhitePercent, formatEvaluation } from './EvaluationBar'

describe('EvaluationBar', () => {
  it('uses a neutral balance while Stockfish has not reported a score', () => {
    expect(evaluationWhitePercent(null)).toBe(50)
  })

  it('maps white-positive centipawns to the white side of the bar', () => {
    expect(evaluationWhitePercent({ scoreCp: 500, mate: null, depth: 12 })).toBeGreaterThan(75)
    expect(evaluationWhitePercent({ scoreCp: -500, mate: null, depth: 12 })).toBeLessThan(25)
  })

  it('formats centipawn and mate evaluations for the sidebar', () => {
    expect(formatEvaluation({ scoreCp: 42, mate: null, depth: 12 })).toBe('+0.4')
    expect(formatEvaluation({ scoreCp: -42, mate: null, depth: 12 })).toBe('-0.4')
    expect(formatEvaluation({ scoreCp: 100000, mate: 3, depth: 20 })).toBe('M+3')
    expect(formatEvaluation({ scoreCp: -100000, mate: -2, depth: 20 })).toBe('M-2')
  })
})
