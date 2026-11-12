import { describe, expect, it } from 'vitest'
import { armMinefield, createMinefield, revealMinefieldCell, scanMinefieldEcho, toggleMinefieldFlag } from './model'
import { analyzeMinefield, generateSolvableMinefield, solveMinefield, toVisibleMinefield } from './solver'

describe('deduction-only generation', () => {
  it.each([[9, 9, 10], [16, 16, 40], [30, 16, 99]])('certifies random %ix%i boards with %i mines', (width, height, mines) => {
    for (const opening of [0, Math.floor(width * height / 2), width * height - 1]) {
      for (let sample = 0; sample < 5; sample += 1) {
        const board = generateSolvableMinefield(width, height, mines, opening)
        const proof = solveMinefield(board, opening)
        expect(proof.solved).toBe(true)
        expect(board.cells.filter(cell => cell.mine)).toHaveLength(mines)
        expect(proof.revealed.every(i => !board.cells[i].mine)).toBe(true)
        const completed = proof.revealed.reduce(revealMinefieldCell, board)
        expect(completed.status).toBe('won')
      }
    }
  }, 60_000)
  it('rejects an ambiguous endgame and never falls back to an unverified board', () => {
    // Opening at top-left leaves an unconstrained one-of-three far corner.
    const board = armMinefield(createMinefield(4, 2, 1), 0, [3])
    expect(solveMinefield(board, 0).solved).toBe(false)
    expect(() => generateSolvableMinefield(9, 9, 10, 0, 0)).toThrow('verified board')
  })
  it('rejects invalid mine placements', () => {
    for (const mines of [[12, 12], [12, 25], [12, -1]]) {
      expect(() => armMinefield(createMinefield(5, 5, 2), 0, mines)).toThrow('Invalid mine placement')
    }
  })

  it('certifies Elite with necessary subset reasoning and actual cross-clue provenance', () => {
    for (const opening of [0, 27, 63, 64, 91, 127]) {
      const board = generateSolvableMinefield(8, 8, 28, opening, 3000, undefined, { layers: 2, requireAdvanced: true })
      const proof = solveMinefield(board, opening)
      expect(proof.solved).toBe(true)
      expect(proof.crossDeductions).toBeGreaterThan(0)
      expect(proof.subsetDeductions).toBeGreaterThan(0)
      expect(solveMinefield(board, opening, { useSubset: false }).solved).toBe(false)
      expect(solveMinefield(board, opening, { useEcho: false }).solved).toBe(false)
      expect(proof.revealed.every(index => !board.cells[index].mine)).toBe(true)
    }
  })

  it('exposes echoes only after an explicit information request and ignores misplaced flags', () => {
    const board = revealMinefieldCell(armMinefield(createMinefield(3, 3, 2, 2), 0, [8, 9]), 0)
    const before = toVisibleMinefield(board)
    expect(before.cells[0].echo).toBeNull()
    expect(before.cells[9]).toEqual({ revealed: false, flagged: false, adjacent: null, echo: null })
    const scanned = scanMinefieldEcho(board, 0)
    expect(toVisibleMinefield(scanned).cells[0].echo).toBe(1)
    const covered = board.cells.findIndex(cell => !cell.revealed && !cell.mine)
    expect(analyzeMinefield(toVisibleMinefield(toggleMinefieldFlag(scanned, covered)))).toEqual(analyzeMinefield(toVisibleMinefield(scanned)))
    expect('mine' in before.cells[0]).toBe(false)
    expect('crossAdjacent' in before.cells[0]).toBe(false)
  })

  it('returns an honest bounded failure rather than a fallback board', () => {
    expect(() => generateSolvableMinefield(8, 8, 28, 0, 3000, undefined, { layers: 2, requireAdvanced: true, maxMs: 0 })).toThrow('search limit')
  })
})
