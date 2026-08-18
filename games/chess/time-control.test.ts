import { describe, expect, it } from 'vitest'
import { chessTimeControl, chessTimeLabel, formatClock } from './time-control'

describe('chess time-control helpers', () => {
  it('resolves a known control and falls back to Blitz 5+0 for unknown ids', () => {
    expect(chessTimeControl('rapid-10').baseSeconds).toBe(600)
    expect(chessTimeControl('nope').id).toBe('blitz-5')
    expect(chessTimeControl(undefined).id).toBe('blitz-5')
  })

  it('formats a readable time-control label', () => {
    expect(chessTimeLabel('rapid-15-10')).toBe('Rapid · 15+10')
    expect(chessTimeLabel('long-60-30')).toBe('Long · 60+30')
  })

  it('formats clocks as M:SS and H:MM:SS and never goes negative', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(59_000)).toBe('0:59')
    expect(formatClock(60_000)).toBe('1:00')
    expect(formatClock(300_500)).toBe('5:01')
    expect(formatClock(3699_000)).toBe('1:01:39')
    expect(formatClock(-1000)).toBe('0:00')
  })
})