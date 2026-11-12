import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { join } from 'node:path'
import { collectRecklessLines, type RecklessAnalysis } from './reckless'
import type { ReportEngineProgress } from './engine-progress'

export const ENGINE_IDLE_MS = 2 * 60 * 60 * 1000
export const UCI_ENGINE_IDS = ['reckless-local', 'builtin-stockfish-18', 'builtin-stockfish-19'] as const
export type UciEngineId = typeof UCI_ENGINE_IDS[number]
export function isUciEngine(id: string): id is UciEngineId { return UCI_ENGINE_IDS.includes(id as UciEngineId) }

export type EngineSearch = { fen: string; multiPv: number; moveTimeMs: number; skill?: number; history?: readonly string[]; onProgress?: ReportEngineProgress; signal?: AbortSignal; onCleanup?: (settled: Promise<void>) => void }

/** One serial UCI channel per selected engine. No process is created on import. */
export class UciRuntime {
  private child: ChildProcessWithoutNullStreams | null = null
  private jobs: Array<{ run: () => Promise<void>; cancel: () => void }> = []
  private active = false
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
        if (this.child === child) this.listener?.(line)
      }
    })
    child.stderr.resume()
    child.stdin.on('error', () => undefined)
    child.on('error', error => { if (this.child !== child) return; this.fail?.(new Error(`${this.id} could not start: ${error.message}`)); this.dispose() })
    child.on('exit', code => {
      if (this.child !== child) return
      this.fail?.(new Error(`${this.id} exited (${code}); retry to restart it`))
      this.dispose()
    })
    return child
  }

  private exchange(commands: string[], end: (line: string) => boolean, timeoutMs: number, signal?: AbortSignal, onLine?: (line: string) => void, searching = false): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const lines: string[] = []
      let settled = false
      let stopTimeout: ReturnType<typeof setTimeout> | undefined
      const finish = (error?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        clearTimeout(stopTimeout)
        signal?.removeEventListener('abort', abort)
        this.listener = null
        this.fail = null
        if (error) reject(error)
        else resolve(lines)
      }
      const abort = () => {
        if (settled) return
        if (searching) {
          // UCI must answer stop with bestmove before the serial channel is reused.
          stopTimeout = setTimeout(() => { finish(new DOMException('Request cancelled', 'AbortError')); this.dispose() }, 1000)
          this.child?.stdin.write('stop\n')
        } else {
          finish(new DOMException('Request cancelled', 'AbortError'))
          this.dispose()
        }
      }
      const timeout = setTimeout(() => { finish(new Error(`${this.id} timed out; retry to restart it`)); this.dispose() }, timeoutMs)
      this.fail = finish
      this.listener = line => { lines.push(line); if (!signal?.aborted) onLine?.(line); if (end(line)) finish() }
      if (signal?.aborted) { finish(new DOMException('Request cancelled', 'AbortError')); return }
      signal?.addEventListener('abort', abort, { once: true })
      this.start().stdin.write(`${commands.join('\n')}\n`)
    })
  }

  private pump() {
    if (this.active) return
    const job = this.jobs.shift()
    if (!job) return
    this.active = true
    void job.run()
  }

  private release() {
      this.active = false
      this.lastUsed = Date.now()
      if (this.jobs.length) this.pump()
      else {
        this.idle = setTimeout(() => this.dispose(), ENGINE_IDLE_MS)
        this.idle.unref?.()
      }
  }

  search(request: EngineSearch): Promise<RecklessAnalysis> {
    let releaseCleanup!: () => void
    const cleanup = new Promise<void>(resolve => { releaseCleanup = resolve })
    try { request.onCleanup?.(cleanup) } catch (error) { releaseCleanup(); return Promise.reject(error) }
    if (request.signal?.aborted) { releaseCleanup(); return Promise.reject(new DOMException('Request cancelled', 'AbortError')) }
    if (this.queued >= 8) { releaseCleanup(); return Promise.reject(new Error('Engine is busy. Please retry shortly.')) }
    try {
      if (this.queued) request.onProgress?.({ stage: 'queued', message: 'Waiting for the selected engine', detail: 'Another request is using this engine.' })
    } catch (error) { releaseCleanup(); return Promise.reject(error) }
    this.queued += 1
    clearTimeout(this.idle)
    return new Promise((resolve, reject) => {
      let settled = false
      let started = false
      const finish = (error?: unknown, result?: RecklessAnalysis) => {
        if (settled) return
        settled = true
        this.queued -= 1
        request.signal?.removeEventListener('abort', cancel)
        if (error) reject(error)
        else resolve(result!)
      }
      const cancel = () => {
        if (!started) {
          this.jobs = this.jobs.filter(item => item !== job)
          releaseCleanup()
        }
        finish(new DOMException('Request cancelled', 'AbortError'))
      }
      const job = { cancel, run: async () => {
        started = true
        let result: RecklessAnalysis | undefined
        let failure: unknown
        try { result = await this.runSearch(request) } catch (error) { failure = error }
        this.release()
        releaseCleanup()
        finish(failure, result)
      } }
      request.signal?.addEventListener('abort', cancel, { once: true })
      this.jobs.push(job)
      if (request.signal?.aborted) cancel()
      this.pump()
    })
  }

  private async runSearch(request: EngineSearch): Promise<RecklessAnalysis> {
    request.signal?.throwIfAborted()
    const report: ReportEngineProgress = progress => { if (!request.signal?.aborted) request.onProgress?.(progress) }
    if (Date.now() - this.lastUsed >= ENGINE_IDLE_MS) this.dispose()
    if (!this.child) {
      report({ stage: 'starting', message: 'Starting the selected engine', detail: 'Loading its runtime and model files.' })
      await this.exchange(['uci'], line => line === 'uciok', 25_000, request.signal)
    }
    request.signal?.throwIfAborted()
    report({ stage: 'initializing', message: 'Preparing the engine and position' })
    await this.exchange([
      'ucinewgame',
      'setoption name Threads value 1',
      'setoption name Hash value 32',
      `setoption name MultiPV value ${request.multiPv}`,
      `setoption name Skill Level value ${request.skill ?? 20}`,
      'isready',
    ], line => line === 'readyok', 5000, request.signal)
    request.signal?.throwIfAborted()
    const position = request.history?.length ? `position startpos moves ${request.history.join(' ')}` : `position fen ${request.fen}`
    const searchStarted = Date.now()
    let lastReport = 0
    report({ stage: 'thinking', message: 'Analyzing the position' })
    request.signal?.throwIfAborted()
    const raw = await this.exchange([position, `go movetime ${request.moveTimeMs}`], line => line.startsWith('bestmove '), request.moveTimeMs + 10_000, request.signal, line => {
      const depth = /\bdepth (\d+)/.exec(line)
      if (!depth || Date.now() - lastReport < 150) return
      lastReport = Date.now()
      const nodes = /\bnodes (\d+)/.exec(line)
      report({ stage: 'thinking', message: 'Analyzing the position', depth: Number(depth[1]), ...(nodes ? { nodes: Number(nodes[1]) } : {}), detail: `Depth ${depth[1]}${nodes ? ` · ${Number(nodes[1]).toLocaleString('en')} positions searched` : ''}` })
    }, true)
    request.signal?.throwIfAborted()
    const bestMove = /^bestmove\s+(\S+)/.exec(raw.at(-1) ?? '')?.[1] ?? ''
    const lines = collectRecklessLines(raw)
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(bestMove)) throw new Error(`${this.id} returned no legal best move`)
    return { bestMove, lines, durationMs: Date.now() - searchStarted }
  }

  dispose() {
    const child = this.child
    this.fail?.(new Error(`${this.id} stopped; retry to restart it`))
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
