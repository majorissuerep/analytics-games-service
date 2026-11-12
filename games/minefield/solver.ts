import { armMinefield, createMinefield, neighbors, revealMinefieldCell, type MinefieldBoard } from './model'

export interface VisibleMinefieldCell {
  revealed: boolean
  flagged: boolean
  adjacent: number | null
  echo: number | null
}
export interface VisibleMinefield {
  width: number
  height: number
  layers: 1 | 2
  mineCount: number
  cells: VisibleMinefieldCell[]
}
export type ClueSource = { kind: 'local' | 'echo' | 'total'; index?: number }
export type ProofConstraint = { cells: number[]; mines: number }
export interface DeductionStep {
  rule: 'single' | 'subset' | 'global'
  safe: number[]
  mines: number[]
  sources: ClueSource[]
  constraints: ProofConstraint[]
  explanation: string
}
export interface MinefieldAnalysis {
  kind: 'deduction' | 'information' | 'stalled' | 'contradiction'
  safe: number[]
  mines: number[]
  steps: DeductionStep[]
  scan?: number
}
export interface AnalysisOptions { useSubset?: boolean; useEcho?: boolean }
type Constraint = ProofConstraint & { sources: ClueSource[]; global?: boolean }

/** The inference boundary: neither hidden mine bits nor unrequested echoes cross it. */
export function toVisibleMinefield(board: MinefieldBoard): VisibleMinefield {
  return {
    width: board.width, height: board.height, layers: board.layers, mineCount: board.mineCount,
    cells: board.cells.map(cell => ({
      revealed: cell.revealed && !cell.mine, flagged: cell.flagged,
      adjacent: cell.revealed && !cell.mine ? cell.adjacent : null,
      echo: cell.revealed && !cell.mine && cell.echoRevealed ? cell.crossAdjacent : null,
    })),
  }
}

function mergeSources(...groups: ClueSource[][]): ClueSource[] {
  const found = new Map<string, ClueSource>()
  for (const group of groups) for (const source of group) found.set(`${source.kind}:${source.index ?? ''}`, source)
  return [...found.values()]
}

/** Ordinary clue constraints, mine-budget arithmetic and subset subtraction.
 * Player flags are annotations, never logical premises. Incompleteness means
 * rejection/stalled, not permission to guess. No hidden-board parameter exists.
 */
export function analyzeMinefield(view: VisibleMinefield, options: AnalysisOptions = {}): MinefieldAnalysis {
  const known = new Uint8Array(view.cells.length) // 0 unknown, 1 open, 2 mine, 3 inferred safe
  const provenance: ClueSource[][] = view.cells.map(() => [])
  const steps: DeductionStep[] = []
  const contradiction = (): MinefieldAnalysis => ({ kind: 'contradiction', safe: [], mines: [], steps: [] })
  if (![view.width, view.height, view.mineCount].every(Number.isInteger) || view.width < 2 || view.height < 2 || ![1, 2].includes(view.layers) || view.cells.length !== view.width * view.height * view.layers || view.mineCount < 0 || view.mineCount >= view.cells.length) return contradiction()
  for (let i = 0; i < known.length; i += 1) if (view.cells[i].revealed) known[i] = 1
  let invalid = false
  const infer = (constraint: Constraint, operands: Constraint[], rule: DeductionStep['rule']) => {
    if (constraint.mines < 0 || constraint.mines > constraint.cells.length) { invalid = true; return false }
    if (!constraint.cells.length || (constraint.mines !== 0 && constraint.mines !== constraint.cells.length)) return false
    const targets = constraint.cells.filter(i => !known[i])
    if (!targets.length) return false
    const mine = constraint.mines !== 0
    if (constraint.cells.some(i => known[i] > 1 && known[i] !== (mine ? 2 : 3))) { invalid = true; return false }
    for (const i of targets) { known[i] = mine ? 2 : 3; provenance[i] = constraint.sources }
    const explanation = rule === 'subset'
      ? `Subtract the smaller clue region from the larger: ${constraint.mines} mines remain in ${constraint.cells.length} cells. ${mine ? 'Every remaining cell is a mine.' : 'Every remaining cell is safe.'}`
      : `${constraint.global ? 'The remaining mine total' : 'This clue region'} has ${constraint.mines} mines in ${constraint.cells.length} covered cells. ${mine ? 'All are mines.' : 'All are safe.'}`
    steps.push({ rule, safe: mine ? [] : targets, mines: mine ? targets : [], sources: constraint.sources, constraints: operands.map(c => ({ cells: [...c.cells], mines: c.mines })), explanation })
    return true
  }
  for (;;) {
    const constraints: Constraint[] = []
    const seen = new Map<string, number>()
    const add = (scope: number[], count: number, source: ClueSource, global = false) => {
      if (!Number.isInteger(count) || count < 0 || count > scope.length) { invalid = true; return }
      const cells = scope.filter(i => !known[i])
      const mines = count - scope.filter(i => known[i] === 2).length
      const sources = mergeSources([source], ...scope.filter(i => known[i] > 1).map(i => provenance[i]))
      if (mines < 0 || mines > cells.length) { invalid = true; return }
      const key = cells.join(',')
      if (seen.has(key) && seen.get(key) !== mines) { invalid = true; return }
      seen.set(key, mines)
      if (cells.length) constraints.push({ cells, mines, sources, global })
    }
    for (let i = 0; i < known.length; i += 1) {
      if (!view.cells[i].revealed) continue
      add(neighbors(view, i), view.cells[i].adjacent as number, { kind: 'local', index: i })
      if (view.layers === 2 && options.useEcho !== false && view.cells[i].echo !== null) add(neighbors(view, i, 'cross'), view.cells[i].echo as number, { kind: 'echo', index: i })
    }
    add([...known.keys()], view.mineCount, { kind: 'total' }, true)
    if (invalid) return contradiction()
    let changed = false
    // These constraints share one immutable knowledge snapshot: their conclusions
    // can be applied together, then the next pass rebuilds all residual regions.
    for (const constraint of constraints) {
      changed = infer(constraint, [constraint], constraint.global ? 'global' : 'single') || changed
    }
    if (invalid) return contradiction()
    if (changed) continue
    if (options.useSubset !== false) {
      outer: for (const a of constraints) {
        const aSet = new Set(a.cells)
        for (const b of constraints) {
          if (a.cells.length >= b.cells.length || !a.cells.every(i => b.cells.includes(i))) continue
          const difference = b.cells.filter(i => !aSet.has(i))
          const derived = { cells: difference, mines: b.mines - a.mines, sources: mergeSources(a.sources, b.sources) }
          if (infer(derived, [a, b], 'subset')) { changed = true; break outer }
          if (invalid) break outer
        }
      }
    }
    if (invalid) return contradiction()
    if (!changed) break
  }
  const safe = [...known.keys()].filter(i => known[i] === 3)
  const mines = [...known.keys()].filter(i => known[i] === 2)
  const scan = view.layers === 2 ? view.cells.findIndex(cell => cell.revealed && cell.echo === null) : -1
  return { kind: safe.length || mines.length ? 'deduction' : scan >= 0 ? 'information' : 'stalled', safe, mines, steps, ...(scan >= 0 ? { scan } : {}) }
}

export interface MinefieldProof {
  solved: boolean
  revealed: number[]
  mines: number[]
  steps: DeductionStep[]
  crossDeductions: number
  subsetDeductions: number
}

/** Certification requests all available echoes; players may request them in any order.
 * Reveals occur only after visible-only deductions. Mine bits are never move selectors.
 */
export function solveMinefield(board: MinefieldBoard, opening: number, options: AnalysisOptions = {}): MinefieldProof {
  let current = revealMinefieldCell({ ...board, cells: board.cells.map(cell => ({ ...cell, revealed: false, flagged: false, echoRevealed: false })), status: 'playing' }, opening)
  const steps: DeductionStep[] = []
  let inferred: number[] = []
  for (let iteration = 0; iteration <= board.cells.length; iteration += 1) {
    const revealed = current.cells.flatMap((cell, i) => cell.revealed && !cell.mine ? [i] : [])
    const finish = (solved: boolean): MinefieldProof => ({ solved, revealed, mines: inferred, steps, crossDeductions: steps.filter(step => step.sources.some(source => source.kind === 'echo')).length, subsetDeductions: steps.filter(step => step.rule === 'subset').length })
    if (revealed.length === board.cells.length - board.mineCount) return finish(true)
    if (current.status === 'lost') return finish(false)
    current = { ...current, cells: current.cells.map(cell => ({ ...cell, echoRevealed: board.layers === 2 && cell.revealed })) }
    const analysis = analyzeMinefield(toVisibleMinefield(current), options)
    if (analysis.kind === 'contradiction') return finish(false)
    steps.push(...analysis.steps)
    inferred = analysis.mines
    if (!analysis.safe.length) return finish(false)
    for (const i of analysis.safe) current = revealMinefieldCell(current, i)
  }
  return { solved: false, revealed: [], mines: [], steps, crossDeductions: 0, subsetDeductions: 0 }
}

export interface GenerationOptions { layers?: 1 | 2; requireAdvanced?: boolean; maxMs?: number }
/** Standard rejection sampling: return only a proof-certified fixed layout. */
export function generateSolvableMinefield(width: number, height: number, mines: number, opening: number, maxAttempts = 3000, onAttempt?: (attempt: number) => void, options: GenerationOptions = {}): MinefieldBoard {
  const empty = createMinefield(width, height, mines, options.layers ?? 1)
  const started = performance.now()
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (performance.now() - started >= (options.maxMs ?? 8000)) break
    onAttempt?.(attempt + 1)
    const board = armMinefield(empty, opening)
    const proof = solveMinefield(board, opening)
    if (!proof.solved) continue
    if (options.requireAdvanced && (!proof.crossDeductions || solveMinefield(board, opening, { useSubset: false }).solved || solveMinefield(board, opening, { useEcho: false }).solved)) continue
    if (performance.now() - started >= (options.maxMs ?? 8000)) break
    return board
  }
  throw new Error('Could not find a verified board within the search limit. Retry or try a new opening.')
}
