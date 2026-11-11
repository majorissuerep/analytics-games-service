import { describe, expect, it } from 'vitest'
import { armMinefield, createMinefield, revealMinefieldCell } from './model'
import { generateSolvableMinefield, solveMinefield } from './solver'

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
})
