import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { join } from 'node:path'
import { collectRecklessLines, type RecklessAnalysis } from './reckless'

export const ENGINE_IDLE_MS = 2 * 60 * 60 * 1000
export const UCI_ENGINE_IDS = ['reckless-local', 'builtin-stockfish-18', 'builtin-stockfish-19'] as const
export type UciEngineId = typeof UCI_ENGINE_IDS[number]
export function isUciEngine(id: string): id is UciEngineId { return UCI_ENGINE_IDS.includes(id as UciEngineId) }

export type EngineSearch = { fen: string; multiPv: number; moveTimeMs: number; skill?: number; history?: readonly string[] }

/** One serial UCI channel per selected engine. No process is created on import. */
export class UciRuntime {
  private child: ChildProcessWithoutNullStreams | null = null
  private tail: Promise<unknown> = Promise.resolve()
  private listener: ((line: string) => void) | null = null
  private fail: ((error: Error) => void) | null = null
  private idle: ReturnType<typeof setTimeout> | undefined
  private queued = 0
  lastUsed = Date.now()

  constructor(readonly id: UciEngineId) {}

  private start() {
    if (this.child) return this.child
    const root = process.cwd()
    const executable = this.id === 'reckless-local'
      ? process.env.RECKLESS_BINARY_PATH ?? join(root, 'vendor/native/reckless/reckless')
      : process.execPath
    const args = this.id === 'builtin-stockfish-18' ? [join(root, 'public/vendor/stockfish/stockfish-18-lite-single.js')]
      : this.id === 'builtin-stockfish-19' ? [join(root, 'scripts/chess/stockfish19.mjs')] : []
    // Executable paths are fixed above or set by the operator, never supplied by a player.
    const child = spawn(executable, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    this.child = child
    let buffer = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk
      let end: number
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).trim()
        buffer = buffer.slice(end + 1)
        this.listener?.(line)
      }
    })
    child.stderr.resume()
    child.stdin.on('error', () => undefined)
    child.on('error', error => { this.fail?.(new Error(`${this.id} could not start: ${error.message}`)); this.dispose() })
    child.on('exit', code => {
      if (this.child !== child) return
      this.fail?.(new Error(`${this.id} exited (${code}); retry to restart it`))
      this.dispose()
    })
    return child
  }

  private exchange(commands: string[], end: (line: string) => boolean, timeoutMs: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const lines: string[] = []
      const timeout = setTimeout(() => { reject(new Error(`${this.id} timed out; retry to restart it`)); this.dispose() }, timeoutMs)
      const finish = (error?: Error) => {
        clearTimeout(timeout)
        this.listener = null
        this.fail = null
        if (error) reject(error)
        else resolve(lines)
      }
      this.fail = finish
      this.listener = line => { lines.push(line); if (end(line)) finish() }
      this.start().stdin.write(`${commands.join('\n')}\n`)
    })
  }

  search(request: EngineSearch): Promise<RecklessAnalysis> {
    if (this.queued >= 8) return Promise.reject(new Error('Engine is busy. Please retry shortly.'))
    this.queued += 1
    clearTimeout(this.idle)
    const task = this.tail.catch(() => undefined).then(async () => {
      // Wall time also expires instances frozen by the serverless platform.
      if (Date.now() - this.lastUsed >= ENGINE_IDLE_MS) this.dispose()
      if (!this.child) await this.exchange(['uci'], line => line === 'uciok', 25_000)
      await this.exchange([
        'ucinewgame',
        'setoption name Threads value 1',
        'setoption name Hash value 32',
        `setoption name MultiPV value ${request.multiPv}`,
        `setoption name Skill Level value ${request.skill ?? 20}`,
        'isready',
      ], line => line === 'readyok', 5000)
      const position = request.history?.length ? `position startpos moves ${request.history.join(' ')}` : `position fen ${request.fen}`
      const searchStarted = Date.now()
      const raw = await this.exchange([position, `go movetime ${request.moveTimeMs}`], line => line.startsWith('bestmove '), request.moveTimeMs + 10_000)
      const bestMove = /^bestmove\s+(\S+)/.exec(raw.at(-1) ?? '')?.[1] ?? ''
      const lines = collectRecklessLines(raw)
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(bestMove)) throw new Error(`${this.id} returned no legal best move`)
      return { bestMove, lines, durationMs: Date.now() - searchStarted }
    })
    this.tail = task
    return task.finally(() => {
      this.queued -= 1
      this.lastUsed = Date.now()
      if (!this.queued) {
        this.idle = setTimeout(() => this.dispose(), ENGINE_IDLE_MS)
        this.idle.unref?.()
      }
    })
  }

  dispose() {
    const child = this.child
    this.child = null
    clearTimeout(this.idle)
    this.listener = null
    this.fail = null
    child?.kill('SIGKILL')
  }
}

// globalThis survives development reloads and warm Vercel invocations.
const cache = globalThis as typeof globalThis & { chessRuntimes?: Map<UciEngineId, UciRuntime> }
const runtimes = cache.chessRuntimes ??= new Map()
export function analyseWithEngine(id: UciEngineId, request: EngineSearch) {
  let engine = runtimes.get(id)
  if (!engine) { engine = new UciRuntime(id); runtimes.set(id, engine) }
  return engine.search(request)
}
