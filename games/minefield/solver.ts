import { armMinefield, createMinefield, neighbors, type MinefieldBoard } from './model'

type Constraint = { cells: number[]; mines: number }

/** Only revealed clues and the total mine count are used to infer moves.
 * Hidden mine bits are read solely when opening an already-proven safe cell.
 * Subset subtraction is sound but incomplete: hard solvable boards may be rejected.
 */
export function solveMinefield(board: MinefieldBoard, opening: number): { solved: boolean; revealed: number[]; mines: number[] } {
  const known = new Uint8Array(board.cells.length) // 0 unknown, 1 revealed, 2 inferred mine
  const around = board.cells.map((_, i) => neighbors(board, i))
  const queue = [opening]
  const finish = () => ({
    solved: known.filter(value => value === 1).length === board.cells.length - board.mineCount,
    revealed: [...known.keys()].filter(i => known[i] === 1),
    mines: [...known.keys()].filter(i => known[i] === 2),
  })
  for (;;) {
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const i = queue[cursor]
      if (known[i]) continue
      if (!board.cells[i] || board.cells[i].mine) return { ...finish(), solved: false }
      known[i] = 1
      if (board.cells[i].adjacent === 0) queue.push(...around[i].filter(j => !known[j]))
    }
    queue.length = 0
    if (finish().solved) return finish()
    let changed = false
    const constraints: Constraint[] = []
    const add = (cells: number[], mines: number) => {
      if (!cells.length) return
      if (mines === 0) { queue.push(...cells); changed = true }
      else if (mines === cells.length) {
        for (const i of cells) if (!known[i]) { known[i] = 2; changed = true }
      } else constraints.push({ cells, mines })
    }
    for (let i = 0; i < known.length; i += 1) {
      if (known[i] !== 1) continue
      add(around[i].filter(j => !known[j]), board.cells[i].adjacent - around[i].filter(j => known[j] === 2).length)
    }
    if (changed) continue
    const unknown = [...known.keys()].filter(i => !known[i])
    add(unknown, board.mineCount - known.filter(value => value === 2).length)
    if (changed) continue
    // Include the global mine budget; it can settle isolated endgame regions.
    for (const a of constraints) {
      const aSet = new Set(a.cells)
      for (const b of constraints) {
        if (a.cells.length >= b.cells.length || !a.cells.every(i => b.cells.includes(i))) continue
        const difference = b.cells.filter(i => !aSet.has(i))
        const remaining = b.mines - a.mines
        if (remaining === 0) { queue.push(...difference); changed = true }
        else if (remaining === difference.length) {
          for (const i of difference) if (!known[i]) { known[i] = 2; changed = true }
        }
      }
    }
    if (!changed) return finish()
  }
}

/** Rejection sampling: never return an uncertified board or relocate live mines. */
export function generateSolvableMinefield(width: number, height: number, mines: number, opening: number, maxAttempts = 3000, onAttempt?: (attempt: number) => void): MinefieldBoard {
  const empty = createMinefield(width, height, mines)
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    onAttempt?.(attempt + 1)
    const board = armMinefield(empty, opening)
    if (solveMinefield(board, opening).solved) return board
  }
  throw new Error('Could not find a verified board. Please try a new opening.')
}
