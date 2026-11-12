import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Chess } from 'chess.js'

vi.mock('next/server', async importOriginal => ({ ...await importOriginal<typeof import('next/server')>(), after: vi.fn() }))
vi.mock('@/lib/engine/uci-runtime', () => ({
  isUciEngine: (id: string) => ['reckless-local', 'builtin-stockfish-18', 'builtin-stockfish-19'].includes(id),
  analyseWithEngine: vi.fn(),
}))
import { after } from 'next/server'
import { analyseWithEngine } from '@/lib/engine/uci-runtime'
import { POST } from './route'

beforeEach(() => vi.clearAllMocks())
describe('model-move provider retention adapter', () => {
  it.each(['reckless-local', 'builtin-stockfish-18', 'builtin-stockfish-19'])('retains actual %s channel cleanup after independent stream cancellation', async revisionId => {
    let release!: () => void
    const cleanup = new Promise<void>(resolve => { release = resolve })
    let signal!: AbortSignal
    vi.mocked(analyseWithEngine).mockImplementationOnce(async (_id, input) => {
      expect(after).toHaveBeenCalledOnce()
      signal = input.signal!
      input.onCleanup!(cleanup)
      await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
      return { bestMove: 'e2e4', lines: [] }
    })
    const chess = new Chess()
    const request = new Request('http://localhost/api/chess-models/test/move', {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify({ fen: chess.fen(), history: [], legalMoves: chess.moves({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion ?? ''}`), moveTimeMs: 100 }),
    })
    const response = await POST(request, { params: Promise.resolve({ revisionId }) })
    const reader = response.body!.getReader()
    await reader.read()
    await reader.cancel()
    expect(signal.aborted).toBe(true)
    expect(request.signal.aborted).toBe(false)
    const retained = (vi.mocked(after).mock.calls[0][0] as () => Promise<void>)()
    let finished = false
    void retained.then(() => { finished = true })
    for (let i = 0; i < 10; i++) await Promise.resolve()
    expect(finished).toBe(false)
    release()
    await retained
    expect(finished).toBe(true)
  })
})
