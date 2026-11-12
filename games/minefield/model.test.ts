import { describe, expect, it } from 'vitest'
import {
  armMinefield,
  createMinefield,
  revealMinefieldCell,
  toggleMinefieldFlag,
  neighbors,
  scanMinefieldEcho,
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

  it('keeps layers distinct and counts the exact opposite-layer footprint', () => {
    const board = armMinefield(createMinefield(8, 8, 3, 2), 0, [64, 65, 74])
    expect(neighbors(board, 0)).toEqual([1, 8, 9])
    expect(neighbors(board, 0, 'cross')).toEqual([64, 65, 72, 73])
    expect(neighbors(board, 27, 'cross')).toHaveLength(9)
    expect(neighbors(board, 64)).toEqual([65, 72, 73])
    expect(board.cells[0].adjacent).toBe(0)
    // A zero local opening never promises a zero echo or a safe aligned cell.
    expect(board.cells[0].crossAdjacent).toBe(2)
    expect(board.cells[64].mine).toBe(true)
  })

  it('scans only revealed safe cells and never spends a resource or opens a cell', () => {
    const board = armMinefield(createMinefield(3, 3, 2, 2), 0, [8, 9])
    expect(scanMinefieldEcho(board, 0)).toBe(board)
    const opened = revealMinefieldCell(board, 0)
    const scanned = scanMinefieldEcho(opened, 0)
    expect(scanned.cells[0].echoRevealed).toBe(true)
    expect(scanned.cells[0].crossAdjacent).toBe(1)
    expect(scanned.cells.filter(cell => cell.revealed)).toHaveLength(opened.cells.filter(cell => cell.revealed).length)
    expect(scanMinefieldEcho(scanned, 0)).toBe(scanned)
    expect(scanMinefieldEcho(scanned, 9)).toBe(scanned)
    expect(scanned.cells.map(cell => cell.mine)).toEqual(board.cells.map(cell => cell.mine))
  })
})
