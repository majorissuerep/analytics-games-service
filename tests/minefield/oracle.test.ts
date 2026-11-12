import { describe, expect, it } from 'vitest'
import { analyzeMinefield, toVisibleMinefield, type VisibleMinefield } from '../../games/minefield/solver'
import { armMinefield, createMinefield, revealMinefieldCell } from '../../games/minefield/model'

// Independent model-counting oracle. No production neighbor, solver, generation,
// or flag deductions are used to construct feasible worlds.
function scope(width: number, height: number, index: number, echo: boolean) {
  const area = width * height, layer = Math.floor(index / area)
  const x = index % width, y = Math.floor(index % area / width), result: number[] = []
  for (let target = 0; target < area * (echo ? 2 : layer + 1); target++) {
    const z = Math.floor(target / area), tx = target % width, ty = Math.floor(target % area / width)
    if (z !== (echo ? 1 - layer : layer) || Math.abs(x - tx) > 1 || Math.abs(y - ty) > 1 || (!echo && target === index)) continue
    result.push(target)
  }
  return result
}
function placements(count: number, mines: number) {
  const result: number[][] = []
  const choose = (start: number, selected: number[]) => {
    if (selected.length === mines) { result.push(selected); return }
    for (let i = start; i <= count - (mines - selected.length); i++) choose(i + 1, [...selected, i])
  }
  choose(0, [])
  return result
}
function count(world: number[], cells: number[]) { return cells.filter(index => world.includes(index)).length }
function feasible(view: VisibleMinefield, worlds: number[][]) {
  return worlds.filter(world => view.cells.every((cell, index) => !cell.revealed || (
    !world.includes(index)
    && cell.adjacent === count(world, scope(view.width, view.height, index, false))
    && (cell.echo === null || cell.echo === count(world, scope(view.width, view.height, index, true)))
  )))
}

describe('visible Minefield certainty against an independent feasible-world oracle', () => {
  it('never declares a safe cell or mine that disagrees with any feasible world, including wrong flags and partially scanned layers', () => {
    let views = 0, deductions = 0, ambiguous = 0
    for (const [width, height, layers, mines] of [[3, 2, 1, 2], [3, 3, 1, 2], [2, 2, 2, 2], [3, 2, 2, 2]] as const) {
      const worlds = placements(width * height * layers, mines)
      for (const world of worlds) for (let pattern = 0; pattern < 4; pattern++) {
        const view: VisibleMinefield = { width, height, layers, mineCount: mines, cells: Array.from({ length: width * height * layers }, (_, index) => {
          const revealed = !world.includes(index) && (pattern === 3 ? index % 3 !== 1 : index % 4 === pattern)
          return { revealed, flagged: !revealed && index % 3 === 0, adjacent: revealed ? count(world, scope(width, height, index, false)) : null,
            echo: layers === 2 && revealed && (index + pattern) % 2 === 0 ? count(world, scope(width, height, index, true)) : null }
        }) }
        const possible = feasible(view, worlds), result = analyzeMinefield(view)
        expect(possible.length, 'the source world must remain feasible').toBeGreaterThan(0)
        expect(result.kind).not.toBe('contradiction')
        for (const index of result.safe) expect(possible.every(candidate => !candidate.includes(index)), `false safe at ${index}`).toBe(true)
        for (const index of result.mines) expect(possible.every(candidate => candidate.includes(index)), `false mine at ${index}`).toBe(true)
        for (const step of result.steps) {
          for (const index of step.safe) expect(possible.every(candidate => !candidate.includes(index))).toBe(true)
          for (const index of step.mines) expect(possible.every(candidate => candidate.includes(index))).toBe(true)
        }
        const unflagged = { ...view, cells: view.cells.map(cell => ({ ...cell, flagged: false })) }
        const other = analyzeMinefield(unflagged)
        expect(other.safe).toEqual(result.safe); expect(other.mines).toEqual(result.mines)
        views++; deductions += result.safe.length + result.mines.length
        if (possible.length > 1) ambiguous++
      }
    }
    expect(views).toBe(580); expect(deductions).toBeGreaterThan(200); expect(ambiguous).toBeGreaterThan(100)
    console.log(JSON.stringify({ independentOracle: { views, deductions, ambiguous, domain: 'all2-mine placements on3x2,3x3,2x2x2,3x2x2;4visible patterns each' } }))
  })

  it('does not leak hidden mines, unopened local counts, or unscanned echoes into public analysis', () => {
    const board = revealMinefieldCell(armMinefield(createMinefield(4, 4, 3, 2), 0, [10, 18, 31]), 0)
    const visible = toVisibleMinefield(board)
    const mutated = { ...board, cells: board.cells.map(cell => ({ ...cell, mine: cell.revealed ? cell.mine : !cell.mine, adjacent: cell.revealed ? cell.adjacent : 8, crossAdjacent: 9 })) }
    expect(toVisibleMinefield(mutated)).toEqual(visible)
    expect(analyzeMinefield(toVisibleMinefield(mutated))).toEqual(analyzeMinefield(visible))
    const guarded = { ...board, cells: board.cells.map(cell => {
      const copy = { ...cell }
      Object.defineProperty(copy, 'crossAdjacent', { get() { throw new Error('Unscanned echo was read') } })
      if (!cell.revealed) for (const key of ['mine', 'adjacent']) Object.defineProperty(copy, key, { get() { throw new Error('Covered truth was read') } })
      return copy
    }) }
    expect(toVisibleMinefield(guarded)).toEqual(visible)
    expect(visible.cells.every(cell => cell.echo === null)).toBe(true)
    expect(visible.cells.filter(cell => !cell.revealed).every(cell => cell.adjacent === null)).toBe(true)
  })

  it('rejects contradictory public clues without interpreting flags as contradictions', () => {
    const view: VisibleMinefield = { width: 2, height: 2, layers: 1, mineCount: 1, cells: [
      { revealed: true, flagged: false, adjacent: 0, echo: null },
      { revealed: false, flagged: true, adjacent: null, echo: null },
      { revealed: false, flagged: false, adjacent: null, echo: null },
      { revealed: false, flagged: false, adjacent: null, echo: null },
    ] }
    expect(feasible(view, placements(4, 1))).toHaveLength(0)
    expect(analyzeMinefield(view).kind).toBe('contradiction')
  })
})
