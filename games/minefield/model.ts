export type MinefieldStatus = 'playing' | 'won' | 'lost'

export interface MinefieldCell {
  mine: boolean
  revealed: boolean
  flagged: boolean
  adjacent: number
}

export interface MinefieldBoard {
  width: number
  height: number
  mineCount: number
  armed: boolean
  status: MinefieldStatus
  cells: MinefieldCell[]
}

export function createMinefield(width: number, height: number, mineCount: number): MinefieldBoard {
  if (width < 2 || height < 2 || mineCount < 1 || mineCount >= width * height) {
    throw new Error('Invalid minefield dimensions')
  }
  return {
    width,
    height,
    mineCount,
    armed: false,
    status: 'playing',
    cells: Array.from({ length: width * height }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
    })),
  }
}

function neighbors(board: MinefieldBoard, index: number) {
  const x = index % board.width
  const y = Math.floor(index / board.width)
  const result: number[] = []
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx
      const ny = y + dy
      if ((dx !== 0 || dy !== 0) && nx >= 0 && nx < board.width && ny >= 0 && ny < board.height) {
        result.push(ny * board.width + nx)
      }
    }
  }
  return result
}

function randomMineIndexes(candidates: number[], count: number) {
  const scores = crypto.getRandomValues(new Uint32Array(candidates.length))
  return candidates
    .map((index, position) => ({ index, score: scores[position] }))
    .sort((left, right) => left.score > right.score ? -1 : left.score < right.score ? 1 : 0)
    .slice(0, count)
    .map(({ index }) => index)
}

export function armMinefield(board: MinefieldBoard, safeIndex: number, mines?: readonly number[]): MinefieldBoard {
  if (board.armed) return board
  const forbidden = new Set([safeIndex, ...neighbors(board, safeIndex)])
  const candidates = board.cells.map((_, index) => index).filter((index) => !forbidden.has(index))
  if (board.mineCount > candidates.length) throw new Error('Mine count leaves no safe opening')
  const mineIndexes = mines ? [...mines] : randomMineIndexes(candidates, board.mineCount)
  if (mineIndexes.length !== board.mineCount || mineIndexes.some((index) => forbidden.has(index))) {
    throw new Error('Invalid mine placement')
  }
  const mineSet = new Set(mineIndexes)
  const cells = board.cells.map((cell, index) => ({ ...cell, mine: mineSet.has(index) }))
  const armed = { ...board, armed: true, cells }
  return {
    ...armed,
    cells: cells.map((cell, index) => ({
      ...cell,
      adjacent: neighbors(armed, index).filter((neighbor) => cells[neighbor].mine).length,
    })),
  }
}

export function revealMinefieldCell(board: MinefieldBoard, index: number): MinefieldBoard {
  if (!board.armed || board.status !== 'playing' || board.cells[index]?.flagged || board.cells[index]?.revealed) {
    return board
  }
  const cells = board.cells.map((cell) => ({ ...cell }))
  if (cells[index].mine) {
    cells.forEach((cell) => { if (cell.mine) cell.revealed = true })
    return { ...board, status: 'lost', cells }
  }

  const queue = [index]
  const visited = new Set<number>()
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined || visited.has(current)) continue
    visited.add(current)
    const cell = cells[current]
    if (cell.flagged || cell.mine) continue
    cell.revealed = true
    if (cell.adjacent === 0) queue.push(...neighbors(board, current))
  }

  const won = cells.every((cell) => cell.mine || cell.revealed)
  if (won) cells.forEach((cell) => { if (cell.mine) cell.flagged = true })
  return { ...board, status: won ? 'won' : 'playing', cells }
}

export function toggleMinefieldFlag(board: MinefieldBoard, index: number): MinefieldBoard {
  const cell = board.cells[index]
  if (board.status !== 'playing' || !cell || cell.revealed) return board
  const flaggedCount = board.cells.filter((candidate) => candidate.flagged).length
  if (!cell.flagged && flaggedCount >= board.mineCount) return board
  return {
    ...board,
    cells: board.cells.map((candidate, candidateIndex) => candidateIndex === index
      ? { ...candidate, flagged: !candidate.flagged }
      : candidate),
  }
}
