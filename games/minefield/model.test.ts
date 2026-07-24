import { describe, expect, it } from 'vitest'
import {
  armMinefield,
  createMinefield,
  revealMinefieldCell,
  toggleMinefieldFlag,
} from './model'

describe('minefield model', () => {
  it('keeps the first opening and its neighbors safe', () => {
    const board = armMinefield(createMinefield(5, 5, 2), 0, [12, 24])
    expect(board.cells[0].mine).toBe(false)
    expect(board.cells[1].mine).toBe(false)
    expect(board.cells[5].mine).toBe(false)
    expect(board.cells[6].mine).toBe(false)
    expect(board.cells.filter((cell) => cell.mine)).toHaveLength(2)
  })

  it('floods safe cells and recognizes a win', () => {
    const board = armMinefield(createMinefield(3, 3, 1), 0, [8])
    const revealed = revealMinefieldCell(board, 0)
    expect(revealed.status).toBe('won')
    expect(revealed.cells[8].flagged).toBe(true)
  })

  it('reveals all mines after a loss', () => {
    const board = armMinefield(createMinefield(3, 3, 1), 0, [8])
    const lost = revealMinefieldCell(board, 8)
    expect(lost.status).toBe('lost')
    expect(lost.cells[8].revealed).toBe(true)
  })

  it('toggles flags without exceeding mine count', () => {
    const board = createMinefield(3, 3, 1)
    const flagged = toggleMinefieldFlag(board, 1)
    expect(flagged.cells[1].flagged).toBe(true)
    expect(toggleMinefieldFlag(flagged, 2)).toBe(flagged)
    expect(toggleMinefieldFlag(flagged, 1).cells[1].flagged).toBe(false)
  })
})
