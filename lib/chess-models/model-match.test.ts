import { describe, expect, it } from 'vitest'
import { applyMatchMove, createModelMatchState, setMatchPaused } from './model-match'

describe('model match state', () => {
  it('creates a running match with a fixed three second turn budget', () => {
    const match = createModelMatchState('white-rev', 'black-rev', new Date('2026-07-25T12:00:00Z'))
    expect(match.status).toBe('active')
    expect(match.turnBudgetMs).toBe(3000)
    expect(match.moves).toEqual([])
  })

  it('appends a legal move and immutable replay snapshot', () => {
    const match = createModelMatchState('white-rev', 'black-rev', new Date('2026-07-25T12:00:00Z'))
    const moved = applyMatchMove(match, 'e2e4', 842, new Date('2026-07-25T12:00:01Z'))
    expect(moved.moves[0]).toMatchObject({ ply: 1, uci: 'e2e4', san: 'e4', durationMs: 842 })
    expect(moved.moves[0].fen).toContain(' b ')
    expect(moved.fen).toBe(moved.moves[0].fen)
    const reply = applyMatchMove(moved, 'e7e5', 700, new Date('2026-07-25T12:00:02Z'))
    expect(reply.pgn).toContain('1. e4 e5')
  })

  it('rejects illegal, stale, paused, and over-budget moves', () => {
    const match = createModelMatchState('white-rev', 'black-rev', new Date())
    expect(() => applyMatchMove(match, 'e2e5', 100, new Date())).toThrow('illegal')
    expect(() => applyMatchMove(match, 'e2e4', 3001, new Date())).toThrow('budget')
    const moved = applyMatchMove(match, 'e2e4', 100, new Date())
    expect(() => applyMatchMove(moved, 'e7e5', 100, new Date(), 0)).toThrow('stale')
    expect(() => applyMatchMove(setMatchPaused(match, true), 'e2e4', 100, new Date())).toThrow('paused')
  })

  it('pauses and resumes without changing board history', () => {
    const match = createModelMatchState('white-rev', 'black-rev', new Date())
    const paused = setMatchPaused(match, true)
    expect(paused.status).toBe('paused')
    const resumed = setMatchPaused(paused, false)
    expect(resumed.status).toBe('active')
    expect(resumed.fen).toBe(match.fen)
    expect(resumed.moves).toEqual([])
  })
})
