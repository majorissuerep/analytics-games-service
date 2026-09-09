import type { Color, Square } from 'chess.js'

export type StockfishEngineId = 'stockfish-18' | 'stockfish-19'

export interface StockfishEngine {
  id: StockfishEngineId
  label: string
  description: string
  workerUrl: string
}

export const STOCKFISH_WORKER_URL = '/vendor/stockfish/stockfish-18-lite-single.js'
export const STOCKFISH_19_MODULE_URL = '/vendor/stockfish/sf_19_smallnet.js'

export const STOCKFISH_ENGINES: readonly StockfishEngine[] = [
  {
    id: 'stockfish-18',
    label: 'Stockfish 18',
    description: 'Stockfish 18 lite WASM with five difficulty levels.',
    workerUrl: STOCKFISH_WORKER_URL,
  },
  {
    id: 'stockfish-19',
    label: 'Stockfish 19',
    description: 'Stockfish 19 smallnet WASM with five difficulty levels.',
    workerUrl: STOCKFISH_19_MODULE_URL,
  },
]

export type StockfishLevelId = 'beginner' | 'casual' | 'club' | 'advanced' | 'expert'

export interface StockfishLevel {
  id: StockfishLevelId
  label: string
  description: string
  skill: number
  moveTimeMs: number
}

export const STOCKFISH_LEVELS: readonly StockfishLevel[] = [
  { id: 'beginner', label: 'Beginner', description: 'Makes frequent tactical mistakes', skill: 0, moveTimeMs: 100 },
  { id: 'casual', label: 'Casual', description: 'A relaxed club opponent', skill: 5, moveTimeMs: 200 },
  { id: 'club', label: 'Club', description: 'Sees short combinations', skill: 10, moveTimeMs: 350 },
  { id: 'advanced', label: 'Advanced', description: 'Strong positional and tactical play', skill: 15, moveTimeMs: 600 },
  { id: 'expert', label: 'Expert', description: 'Full skill, longer search', skill: 20, moveTimeMs: 1000 },
]

export const STOCKFISH_EVALUATION_NODES = 8000

export interface StockfishEvaluation {
  scoreCp: number
  mate: number | null
  depth: number | null
}

export interface EngineMove {
  from: Square
  to: Square
  promotion?: 'q' | 'r' | 'b' | 'n'
}

export function stockfishEngine(id: StockfishEngineId) {
  return STOCKFISH_ENGINES.find((engine) => engine.id === id) ?? STOCKFISH_ENGINES[0]
}

export function stockfishEngineIdForRevision(revisionId: string): StockfishEngineId | null {
  if (revisionId === 'builtin-stockfish-18') return 'stockfish-18'
  if (revisionId === 'builtin-stockfish-19') return 'stockfish-19'
  return null
}

export function stockfishLevel(id: StockfishLevelId) {
  return STOCKFISH_LEVELS.find((level) => level.id === id) ?? STOCKFISH_LEVELS[2]
}

export function buildStockfishSearchCommands(fen: string, levelId: StockfishLevelId) {
  const level = stockfishLevel(levelId)
  return [
    'stop',
    `setoption name Skill Level value ${level.skill}`,
    `position fen ${fen}`,
    `go movetime ${level.moveTimeMs}`,
  ]
}

export function buildStockfishTimedSearchCommands(fen: string, moveTimeMs: number) {
  return ['stop', 'setoption name Skill Level value 20', `position fen ${fen}`, `go movetime ${moveTimeMs}`]
}

export function buildStockfishEvaluationCommands(fen: string, nodes = STOCKFISH_EVALUATION_NODES) {
  const requestedNodes = Number.isFinite(nodes) ? Math.floor(nodes) : STOCKFISH_EVALUATION_NODES
  const boundedNodes = Math.max(1000, Math.min(STOCKFISH_EVALUATION_NODES, requestedNodes))
  return [
    'stop',
    'setoption name Threads value 1',
    'setoption name Hash value 16',
    'setoption name Skill Level value 20',
    `position fen ${fen}`,
    `go nodes ${boundedNodes}`,
  ]
}

export function parseBestMove(line: string): EngineMove | null {
  const match = /^bestmove\s+([a-h][1-8])([a-h][1-8])([qrbn])?/.exec(line.trim())
  if (!match) return null
  return {
    from: match[1] as Square,
    to: match[2] as Square,
    promotion: match[3] as EngineMove['promotion'],
  }
}

export function parseInfoEvaluation(line: string, sideToMove: Color = 'w'): StockfishEvaluation | null {
  const score = /\bscore\s+(cp|mate)\s+(-?\d+)\b/.exec(line)
  if (!score) return null
  const sign = sideToMove === 'w' ? 1 : -1
  const rawScore = Number(score[2]) * sign
  const depthMatch = /\bdepth\s+(\d+)\b/.exec(line)
  const depth = depthMatch ? Number(depthMatch[1]) : null
  if (score[1] === 'mate') {
    return { scoreCp: rawScore > 0 ? 100000 : -100000, mate: rawScore, depth }
  }
  return { scoreCp: rawScore, mate: null, depth }
}

interface EngineTransport {
  postMessage(command: string): void
  addEventListener(type: 'message', listener: (event: MessageEvent<string | string[]>) => void): void
  addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void
  terminate(): void
}

type Stockfish19Module = {
  uci: (command: string) => void
  setNnueBuffer: (buffer: Uint8Array) => void
}

type Stockfish19Factory = (options: {
  listen: (line: string) => void
  onError: (error: unknown) => void
}) => Promise<Stockfish19Module>

class Stockfish19DirectTransport implements EngineTransport {
  private engine: Stockfish19Module | null = null
  private readonly queuedCommands: string[] = []
  private readonly messageListeners = new Set<(event: MessageEvent<string | string[]>) => void>()
  private readonly errorListeners = new Set<(event: ErrorEvent) => void>()
  private stopped = false

  constructor(moduleUrl: string) {
    void this.initialize(moduleUrl)
  }

  addEventListener(type: 'message' | 'error', listener: ((event: MessageEvent<string | string[]>) => void) | ((event: ErrorEvent) => void)) {
    if (type === 'message') this.messageListeners.add(listener as (event: MessageEvent<string | string[]>) => void)
    else this.errorListeners.add(listener as (event: ErrorEvent) => void)
  }

  postMessage(command: string) {
    if (this.stopped) return
    if (this.engine) this.engine.uci(command)
    else this.queuedCommands.push(command)
  }

  terminate() {
    if (this.stopped) return
    this.stopped = true
    try { this.engine?.uci('quit') } catch { /* The WASM instance may already be gone. */ }
    this.engine = null
    this.queuedCommands.length = 0
  }

  private emitMessage(line: string) {
    if (this.stopped) return
    const event = { data: line } as MessageEvent<string>
    for (const listener of this.messageListeners) listener(event)
  }

  private emitError(error: unknown) {
    if (this.stopped) return
    const event = { message: error instanceof Error ? error.message : String(error) } as ErrorEvent
    for (const listener of this.errorListeners) listener(event)
  }

  private async initialize(moduleUrl: string) {
    try {
      const loaded = await import(/* webpackIgnore: true */ moduleUrl) as { default: Stockfish19Factory }
      const engine = await loaded.default({
        listen: (line) => this.emitMessage(String(line)),
        onError: (error) => this.emitError(error),
      })
      const response = await fetch('/vendor/stockfish/nn-61e7af4bb97d.nnue')
      if (!response.ok) throw new Error(`NNUE request failed with HTTP ${response.status}`)
      engine.setNnueBuffer(new Uint8Array(await response.arrayBuffer()))
      if (this.stopped) return
      this.engine = engine
      this.emitMessage('Stockfish 19')
      for (const command of this.queuedCommands) engine.uci(command)
      this.queuedCommands.length = 0
    } catch (error) {
      this.emitError(error)
    }
  }
}

type PendingSearch =
  | { kind: 'move'; resolve: (move: EngineMove) => void; reject: (error: Error) => void }
  | { kind: 'evaluation'; resolve: (evaluation: StockfishEvaluation | null) => void; reject: (error: Error) => void; latest: StockfishEvaluation | null }

export interface StockfishBrowserEngineOptions {
  workerFactory?: (url: string) => Worker
  engineId?: StockfishEngineId
}

export class StockfishBrowserEngine {
  readonly engineId: StockfishEngineId
  private readonly worker: EngineTransport
  private readonly engineLabel: string
  private readonly readyPromise: Promise<void>
  private resolveReady: (() => void) | null = null
  private rejectReady: ((error: Error) => void) | null = null
  private pendingSearch: PendingSearch | null = null
  private initialized = false
  private destroyed = false
  private sideToMove: Color = 'w'
  private evaluationQueue: Promise<void> = Promise.resolve()

  constructor(options: StockfishBrowserEngineOptions = {}) {
    this.engineId = options.engineId ?? 'stockfish-18'
    const engine = stockfishEngine(this.engineId)
    this.engineLabel = engine.label
    const workerFactory = options.workerFactory ?? ((url: string) => new Worker(url))
    this.worker = this.engineId === 'stockfish-19'
      ? new Stockfish19DirectTransport(engine.workerUrl)
      : workerFactory(engine.workerUrl)
    this.readyPromise = new Promise((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })
    this.worker.addEventListener('message', this.onMessage)
    this.worker.addEventListener('error', this.onError)
  }

  private onMessage = (event: MessageEvent<string | string[]>) => {
    const payload = Array.isArray(event.data) ? event.data : [event.data]
    const lines = payload.flatMap((value) => String(value).split('\n')).map((value) => value.trim())
    for (const line of lines) {
      if (line.startsWith('stockfish-error')) {
        this.failPending(new Error(`${this.engineLabel} failed to load. Reload the game and try again.`))
        continue
      }
      if (!this.initialized && line.startsWith('Stockfish')) {
        this.initialized = true
        this.worker.postMessage('uci')
        this.worker.postMessage('isready')
      }
      if (line === 'readyok') {
        this.resolveReady?.()
        this.resolveReady = null
        this.rejectReady = null
      }
      const evaluation = parseInfoEvaluation(line, this.sideToMove)
      if (evaluation && this.pendingSearch?.kind === 'evaluation') this.pendingSearch.latest = evaluation
      const move = parseBestMove(line)
      if (move && this.pendingSearch) {
        const pending = this.pendingSearch
        this.pendingSearch = null
        if (pending.kind === 'move') pending.resolve(move)
        else pending.resolve(pending.latest)
      }
    }
  }

  private onError = (event: ErrorEvent) => {
    const suffix = event.message ? `: ${event.message}` : ''
    const error = new Error(`${this.engineLabel} failed to load. Reload the game and try again${suffix}.`)
    this.rejectReady?.(error)
    this.rejectReady = null
    this.resolveReady = null
    this.failPending(error)
  }

  private failPending(error: Error) {
    const pending = this.pendingSearch
    this.pendingSearch = null
    pending?.reject(error)
  }

  private replacePending() {
    this.failPending(new Error(`${this.engineLabel} search was replaced by a newer position.`))
  }

  private assertActive() {
    if (this.destroyed) throw new Error(`${this.engineLabel} has been destroyed.`)
  }

  private startSearch(fen: string, pending: PendingSearch, commands: readonly string[]) {
    this.assertActive()
    this.sideToMove = fen.trim().split(/\s+/)[1] === 'b' ? 'b' : 'w'
    this.pendingSearch = pending
    for (const command of commands) this.worker.postMessage(command)
  }

  async findBestMove(fen: string, level: StockfishLevelId) {
    await this.readyPromise
    this.assertActive()
    this.replacePending()
    return new Promise<EngineMove>((resolve, reject) => {
      this.startSearch(fen, { kind: 'move', resolve, reject }, buildStockfishSearchCommands(fen, level))
    })
  }

  async findBestMoveTimed(fen: string, moveTimeMs = 3000) {
    await this.readyPromise
    this.assertActive()
    this.replacePending()
    return new Promise<EngineMove>((resolve, reject) => {
      this.startSearch(fen, { kind: 'move', resolve, reject }, buildStockfishTimedSearchCommands(fen, moveTimeMs))
    })
  }

  evaluate(fen: string, nodes = STOCKFISH_EVALUATION_NODES) {
    const request = this.evaluationQueue.then(async () => {
      await this.readyPromise
      this.assertActive()
      this.replacePending()
      return new Promise<StockfishEvaluation | null>((resolve, reject) => {
        this.startSearch(fen, { kind: 'evaluation', resolve, reject, latest: null }, buildStockfishEvaluationCommands(fen, nodes))
      })
    })
    this.evaluationQueue = request.then(() => undefined, () => undefined)
    return request
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    const error = new Error(`${this.engineLabel} was stopped.`)
    this.rejectReady?.(error)
    this.rejectReady = null
    this.resolveReady = null
    this.failPending(error)
    this.worker.postMessage('quit')
    this.worker.terminate()
  }
}
