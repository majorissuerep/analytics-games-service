export type MinefieldStatus = 'playing' | 'won' | 'lost'

export interface MinefieldCell {
  mine: boolean
  revealed: boolean
  flagged: boolean
  adjacent: number
  crossAdjacent: number
  echoRevealed: boolean
}

export interface MinefieldBoard {
  width: number
  height: number
  layers: 1 | 2
  mineCount: number
  armed: boolean
  status: MinefieldStatus
  cells: MinefieldCell[]
}

export function createMinefield(width: number, height: number, mineCount: number, layers: 1 | 2 = 1): MinefieldBoard {
  if (![width, height, mineCount].every(Number.isInteger) || ![1, 2].includes(layers) || width < 2 || height < 2 || width > 100 || height > 100 || mineCount < 1 || mineCount >= width * height * layers) {
    throw new Error('Invalid minefield dimensions')
  }
  return {
    width,
    height,
    layers,
    mineCount,
    armed: false,
    status: 'playing',
    cells: Array.from({ length: width * height * layers }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
      crossAdjacent: 0,
      echoRevealed: false,
    })),
  }
}

export function neighbors(board: Pick<MinefieldBoard, 'width' | 'height' | 'layers'>, index: number, scope: 'local' | 'cross' = 'local') {
  const size = board.width * board.height
  const layer = Math.floor(index / size)
  const x = index % board.width
  const y = Math.floor(index / board.width) % board.height
  const result: number[] = []
  if (scope === 'cross' && board.layers !== 2) return result
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx
      const ny = y + dy
      if ((scope === 'cross' || dx !== 0 || dy !== 0) && nx >= 0 && nx < board.width && ny >= 0 && ny < board.height) {
        result.push((scope === 'cross' ? 1 - layer : layer) * size + ny * board.width + nx)
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
  if (!Number.isInteger(safeIndex) || !board.cells[safeIndex]) throw new Error('Invalid opening cell')
  const forbidden = new Set([safeIndex, ...neighbors(board, safeIndex)])
  const candidates = board.cells.map((_, index) => index).filter((index) => !forbidden.has(index))
  if (board.mineCount > candidates.length) throw new Error('Mine count leaves no safe opening')
  const mineIndexes = mines ? [...mines] : randomMineIndexes(candidates, board.mineCount)
  if (mineIndexes.length !== board.mineCount || new Set(mineIndexes).size !== board.mineCount || mineIndexes.some((index) => !Number.isInteger(index) || !board.cells[index] || forbidden.has(index))) {
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
      crossAdjacent: neighbors(armed, index, 'cross').filter((neighbor) => cells[neighbor].mine).length,
    })),
  }
}

/** An information request, never a reveal or a guess. Repeated scans are free no-ops. */
export function scanMinefieldEcho(board: MinefieldBoard, index: number): MinefieldBoard {
  const cell = board.cells[index]
  if (board.layers !== 2 || board.status !== 'playing' || !cell?.revealed || cell.mine || cell.echoRevealed) return board
  return { ...board, cells: board.cells.map((candidate, i) => i === index ? { ...candidate, echoRevealed: true } : candidate) }
}

export function revealMinefieldCell(board: MinefieldBoard, index: number): MinefieldBoard {
  if (!board.armed || board.status !== 'playing' || !board.cells[index] || board.cells[index].flagged || board.cells[index].revealed) {
    return board
  }
  const cells = board.cells.map((cell) => ({ ...cell }))
  if (cells[index].mine) {
    cells.forEach((cell) => { if (cell.mine) cell.revealed = true })
    return { ...board, status: 'lost', cells }
  }

  const queue = [index]
  const visited = new Set<number>()
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]
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

/** Standard chord: incorrect flags can still trigger a mine. */
export function chordMinefieldCell(board: MinefieldBoard, index: number): MinefieldBoard {
  const cell = board.cells[index]
  if (!cell?.revealed || cell.mine || !cell.adjacent || board.status !== 'playing') return board
  const around = neighbors(board, index)
  if (around.filter(i => board.cells[i].flagged).length !== cell.adjacent) return board
  return around.reduce((current, i) => revealMinefieldCell(current, i), board)
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
