import type { Square } from 'chess.js'

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

export const STOCKFISH_WORKER_URL = '/vendor/stockfish/stockfish-18-lite-single.js'

export interface EngineMove {
  from: Square
  to: Square
  promotion?: 'q' | 'r' | 'b' | 'n'
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

export function parseBestMove(line: string): EngineMove | null {
  const match = /^bestmove\s+([a-h][1-8])([a-h][1-8])([qrbn])?/.exec(line.trim())
  if (!match) return null
  return {
    from: match[1] as Square,
    to: match[2] as Square,
    promotion: match[3] as EngineMove['promotion'],
  }
}

export class StockfishBrowserEngine {
  private worker: Worker
  private readyPromise: Promise<void>
  private resolveReady: (() => void) | null = null
  private pendingMove: ((move: EngineMove) => void) | null = null
  private pendingReject: ((error: Error) => void) | null = null
  private initialized = false

  constructor(workerFactory: (url: string) => Worker = (url) => new Worker(url)) {
    this.worker = workerFactory(STOCKFISH_WORKER_URL)
    this.readyPromise = new Promise((resolve) => { this.resolveReady = resolve })
    this.worker.addEventListener('message', this.onMessage)
    this.worker.addEventListener('error', this.onError)
  }

  private onMessage = (event: MessageEvent<string | string[]>) => {
    const payload = Array.isArray(event.data) ? event.data : [event.data]
    const lines = payload.flatMap((value) => String(value).split('\n')).map((value) => value.trim())
    for (const line of lines) {
      if (!this.initialized && line.startsWith('Stockfish')) {
        this.initialized = true
        this.worker.postMessage('uci')
        this.worker.postMessage('isready')
      }
      if (line === 'readyok') this.resolveReady?.()
      const move = parseBestMove(line)
      if (move && this.pendingMove) {
        const resolve = this.pendingMove
        this.pendingMove = null
        this.pendingReject = null
        resolve(move)
      }
    }
  }

  private onError = () => {
    this.pendingReject?.(new Error('Stockfish 18 failed to load. Reload the game and try again.'))
    this.pendingMove = null
    this.pendingReject = null
  }

  async findBestMove(fen: string, level: StockfishLevelId) {
    await this.readyPromise
    if (this.pendingReject) this.pendingReject(new Error('Stockfish search was replaced by a newer position.'))
    const result = new Promise<EngineMove>((resolve, reject) => {
      this.pendingMove = resolve
      this.pendingReject = reject
    })
    for (const command of buildStockfishSearchCommands(fen, level)) this.worker.postMessage(command)
    return result
  }

  async findBestMoveTimed(fen: string, moveTimeMs = 3000) {
    await this.readyPromise
    if (this.pendingReject) this.pendingReject(new Error('Stockfish search was replaced by a newer position.'))
    const result = new Promise<EngineMove>((resolve, reject) => {
      this.pendingMove = resolve
      this.pendingReject = reject
    })
    for (const command of buildStockfishTimedSearchCommands(fen, moveTimeMs)) this.worker.postMessage(command)
    return result
  }

  destroy() {
    this.worker.postMessage('quit')
    this.worker.terminate()
  }
}
