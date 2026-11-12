import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Local Reckless (UCI) binary shipped in the repo. Override with RECKLESS_BINARY_PATH. */
export const RECKLESS_BINARY_PATH = process.env.RECKLESS_BINARY_PATH ?? join(process.cwd(), 'vendor', 'native', 'reckless', 'reckless')
export const RECKLESS_IDENTITY = 'Reckless 0.9.0'

export interface RecklessAnalysisLine {
  /** 1-based MultiPV rank; 1 is the engine's best line. */
  multipv: number
  /** Best move of the line in UCI notation, e.g. `e2e4` or `e7e8q`. */
  uci: string
  /** Score in centipawns from the side-to-move perspective, or null for mate scores. */
  scoreCp: number | null
  /** Mate distance from the side-to-move perspective (positive = mating, negative = getting mated). */
  mateIn: number | null
  /** True when the score is only an upper/lower bound (mid-update line). */
  bounded: boolean
  depth: number
  /** Full principal variation in UCI notation. */
  pv: string[]
}

export interface RecklessAnalysis {
  /** Search wall time, excluding cold startup and queue wait. */
  durationMs?: number
  bestMove: string
  lines: RecklessAnalysisLine[]
}

export interface RecklessAnalyseRequest {
  fen: string
  multiPv: number
  moveTimeMs: number
  threads?: number
  hashMb?: number
  onProgress?: import('./engine-progress').ReportEngineProgress
  signal?: AbortSignal
  onCleanup?: (settled: Promise<void>) => void
}

export function recklessAvailable(): boolean {
  // Path may come from RECKLESS_BINARY_PATH (operator override); local server use only.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return existsSync(RECKLESS_BINARY_PATH)
}

function numberToken(line: string, key: string): number | undefined {
  // `key` is always a module-local literal such as `multipv`, never user input.
  // eslint-disable-next-line security/detect-non-literal-regexp
  const match = new RegExp(`\\b${key} (-?\\d+)`).exec(line)
  return match ? Number(match[1]) : undefined
}

const UCI_MOVE = /^[a-h][1-8][a-h][1-8]([qrbn])?$/

/** Parse one `info ... multipv N ... score cp|mate X ... pv <moves>` line, or return null. */
export function parseRecklessInfoLine(line: string): RecklessAnalysisLine | null {
  if (!line.startsWith('info ') || !line.includes(' pv ')) return null
  const scoreMatch = / score (cp|mate) (-?\d+)/.exec(line)
  if (!scoreMatch) return null
  const pv = line.slice(line.indexOf(' pv ') + 4).trim().split(/\s+/)
  if (!pv[0] || !UCI_MOVE.test(pv[0])) return null
  const bounded = line.includes(' upperbound') || line.includes(' lowerbound')
  return {
    multipv: numberToken(line, 'multipv') ?? 1,
    uci: pv[0],
    scoreCp: scoreMatch[1] === 'cp' ? Number(scoreMatch[2]) : null,
    mateIn: scoreMatch[1] === 'mate' ? Number(scoreMatch[2]) : null,
    bounded,
    depth: numberToken(line, 'depth') ?? 0,
    pv,
  }
}

/**
 * Reduce raw `info` lines to one entry per MultiPV index. Engines flush partial
 * lines while iterating, so the LAST line per index wins; bound-flagged lines
 * are only used when an index produced nothing else.
 */
export function collectRecklessLines(rawLines: string[]): RecklessAnalysisLine[] {
  const parsed = rawLines.map(parseRecklessInfoLine).filter((line): line is RecklessAnalysisLine => line !== null)
  const total = Math.max(0, ...parsed.map(line => line.multipv))
  const depths = new Map<number, Map<number, RecklessAnalysisLine>>()
  for (const line of parsed) {
    if (line.bounded) continue
    const iteration = depths.get(line.depth) ?? new Map<number, RecklessAnalysisLine>()
    iteration.set(line.multipv, line)
    depths.set(line.depth, iteration)
  }
  // Never combine a partial new iteration with an older complete iteration.
  const complete = [...depths.entries()].filter(([, lines]) => lines.size === total)
    .sort(([a], [b]) => b - a)[0]?.[1]
  if (complete) return [...complete.values()].sort((a, b) => a.multipv - b.multipv)
  const fallback = new Map<number, RecklessAnalysisLine>()
  for (const line of parsed) {
    const previous = fallback.get(line.multipv)
    if (!previous || !line.bounded || previous.bounded) fallback.set(line.multipv, line)
  }
  return [...fallback.values()].sort((a, b) => a.multipv - b.multipv)
}

/** Compatibility entry point; all callers share the demand-loaded runtime. */
export async function analyseWithReckless(request: RecklessAnalyseRequest): Promise<RecklessAnalysis> {
  request.signal?.throwIfAborted()
  const { analyseWithEngine } = await import('./uci-runtime')
  request.signal?.throwIfAborted()
  return analyseWithEngine('reckless-local', request)
}
