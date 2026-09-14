import { spawn } from 'node:child_process'
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
  bestMove: string
  lines: RecklessAnalysisLine[]
}

export interface RecklessAnalyseRequest {
  fen: string
  multiPv: number
  moveTimeMs: number
  threads?: number
  hashMb?: number
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
  const last = new Map<number, RecklessAnalysisLine>()
  const lastSolid = new Map<number, RecklessAnalysisLine>()
  for (const raw of rawLines) {
    const parsed = parseRecklessInfoLine(raw)
    if (!parsed) continue
    last.set(parsed.multipv, parsed)
    if (!parsed.bounded) lastSolid.set(parsed.multipv, parsed)
  }
  const merged = new Map([...last])
  for (const [index, line] of lastSolid) merged.set(index, line)
  return [...merged.values()].sort((a, b) => a.multipv - b.multipv)
}

/** Spawn the local Reckless binary, run one MultiPV search, and resolve on `bestmove`. */
export function analyseWithReckless(request: RecklessAnalyseRequest): Promise<RecklessAnalysis> {
  return new Promise((resolve, reject) => {
    if (!recklessAvailable()) {
      reject(new Error('Reckless engine binary is missing. Run the chess setup step to install vendor/native/reckless.'))
      return
    }
    const child = spawn(RECKLESS_BINARY_PATH, [], { stdio: ['pipe', 'pipe', 'ignore'] })
    let buffer = ''
    let stage: 'handshake' | 'configured' | 'searching' = 'handshake'
    const rawLines: string[] = []
    let settled = false
    let bestMove = ''

    const finish = (error: Error | null) => {
      if (settled) return
      settled = true
      clearTimeout(guard)
      child.kill()
      const forceKill = setTimeout(() => child.kill('SIGKILL'), 1000)
      forceKill.unref?.()
      if (error) reject(error)
      else resolve({ bestMove, lines: collectRecklessLines(rawLines) })
    }

    const guard = setTimeout(
      () => finish(new Error(`Reckless search timed out after ${request.moveTimeMs + 15000} ms.`)),
      request.moveTimeMs + 15000,
    )
    guard.unref?.()

    child.on('error', (error) => finish(new Error(`Could not start Reckless: ${error.message}`)))
    child.on('exit', (code) => { if (!settled) finish(new Error(`Reckless exited unexpectedly (code ${code}).`)) })
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (line) {
          if (stage === 'handshake' && line === 'uciok') {
            stage = 'configured'
            child.stdin.write(`setoption name Threads value ${request.threads ?? 8}\n`)
            child.stdin.write(`setoption name Hash value ${request.hashMb ?? 256}\n`)
            child.stdin.write(`setoption name MultiPV value ${request.multiPv}\n`)
            child.stdin.write('isready\n')
          } else if (stage === 'configured' && line === 'readyok') {
            stage = 'searching'
            child.stdin.write(`position fen ${request.fen}\n`)
            child.stdin.write(`go movetime ${request.moveTimeMs}\n`)
          } else if (stage === 'searching') {
            if (line.startsWith('info ')) rawLines.push(line)
            else if (line.startsWith('bestmove')) {
              const move = /^bestmove\s+(\S+)/.exec(line)
              bestMove = move?.[1] ?? ''
              finish(null)
            }
          }
        }
        newline = buffer.indexOf('\n')
      }
    })

    child.stdin.on('error', () => undefined)
    child.stdin.write('uci\n')
  })
}
