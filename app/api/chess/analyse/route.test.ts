import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/server', async importOriginal => ({ ...await importOriginal<typeof import('next/server')>(), after: vi.fn() }))

vi.mock('@/lib/engine/reckless', () => ({
  recklessAvailable: vi.fn(() => true),
  analyseWithReckless: vi.fn(async () => ({
    bestMove: 'd2d4',
    lines: [
      { multipv: 1, uci: 'd2d4', scoreCp: 34, mateIn: null, bounded: false, depth: 19, pv: ['d2d4', 'd7d5'] },
      { multipv: 2, uci: 'e2e4', scoreCp: 28, mateIn: null, bounded: false, depth: 19, pv: ['e2e4'] },
    ],
  })),
}))

import { after } from 'next/server'
import { POST } from './route'
import { analyseWithReckless, recklessAvailable } from '@/lib/engine/reckless'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const MATED_FEN = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'

function post(body: unknown) {
  return POST(new Request('http://localhost/api/chess/analyse', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

describe('POST /api/chess/analyse', () => {
  beforeEach(() => {
    vi.mocked(after).mockClear()
    vi.mocked(analyseWithReckless).mockClear()
    vi.mocked(recklessAvailable).mockReturnValue(true)
  })

  it('returns SAN lines, deltas, and balance for a legal position', async () => {
    const response = await post({ fen: START_FEN, multiPv: 2, moveTimeMs: 300 })
    expect(response.status).toBe(200)
    const body = await response.json() as {
      turn: string
      analysis: { balanceLabel: string; lines: Array<{ san: string; deltaCp: number | null; scoreLabel: string }> }
    }
    expect(body.turn).toBe('w')
    expect(body.analysis.balanceLabel).toBe('White +0.34')
    expect(body.analysis.lines[0]).toMatchObject({ san: 'd4', deltaCp: 0, scoreLabel: '+0.34' })
    expect(body.analysis.lines[1]).toMatchObject({ san: 'e4', deltaCp: 6 })
    expect(analyseWithReckless).toHaveBeenCalledWith(expect.objectContaining({ fen: START_FEN, multiPv: 2, moveTimeMs: 300 }))
  })

  it('rejects malformed bodies, invalid FENs, and finished games', async () => {
    expect((await post({ fen: 'nope' })).status).toBe(400)
    expect((await post({ fen: 'not a fen at all' })).status).toBe(400)
    expect((await post({ fen: START_FEN, multiPv: 99 })).status).toBe(400)
    expect((await post({ fen: MATED_FEN })).status).toBe(400)
  })

  it('reports 503 when the binary is missing and 502 when the search fails', async () => {
    vi.mocked(recklessAvailable).mockReturnValue(false)
    expect((await post({ fen: START_FEN })).status).toBe(503)
    vi.mocked(recklessAvailable).mockReturnValue(true)
    vi.mocked(analyseWithReckless).mockRejectedValueOnce(new Error('Reckless exited unexpectedly (code null).'))
    const response = await post({ fen: START_FEN })
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ error: 'Reckless exited unexpectedly (code null).' })
  })
})


describe('analysis route provider retention adapter', () => {
  it('registers Next after before work and forwards the true cleanup lifetime', async () => {
    let release!: () => void
    const cleanup = new Promise<void>(resolve => { release = resolve })
    vi.mocked(analyseWithReckless).mockImplementationOnce(async input => {
      expect(after).toHaveBeenCalledOnce()
      expect(input.signal).toBeInstanceOf(AbortSignal)
      expect(input.onCleanup).toBeTypeOf('function')
      input.onCleanup!(cleanup)
      throw new Error('caller canceled before drain')
    })
    vi.mocked(after).mockClear()
    const response = await post({ fen: START_FEN })
    expect(response.status).toBe(502)
    const retained = (vi.mocked(after).mock.calls[0][0] as () => Promise<void>)()
    let finished = false
    void retained.then(() => { finished = true })
    for (let i = 0; i < 5; i++) await Promise.resolve()
    expect(finished).toBe(false)
    release()
    await retained
    expect(finished).toBe(true)
  })
})
