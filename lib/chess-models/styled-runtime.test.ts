import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseStyledMove, requestStyledMove } from './styled-runtime'

const legalMoves = ['e2e4', 'd2d4']

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('local tuned opening model bridge', () => {
  it('accepts only a move from the authoritative legal set', () => {
    expect(parseStyledMove({ selected_move: 'e2e4' }, legalMoves)).toBe('e2e4')
    expect(() => parseStyledMove({ selected_move: 'e7e5' }, legalMoves)).toThrow('illegal')
    expect(() => parseStyledMove({ selected_move: null }, legalMoves)).toThrow('malformed')
  })

  it('posts the full history and repertoire to the configured sidecar', async () => {
    vi.stubEnv('STYLED_CHESS_INFERENCE_URL', 'http://127.0.0.1:8765')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ selected_move: 'e2e4' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await requestStyledMove({
      fen: 'startpos-fen',
      history: ['e2e4'],
      repertoireId: 'white_italian',
      legalMoves,
      moveTimeMs: 500,
    })

    expect(result).toEqual({ move: 'e2e4', revisionId: 'builtin-styled-opening', repertoireId: 'white_italian' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(url.toString()).toBe('http://127.0.0.1:8765/predict')
    expect(JSON.parse(String(init.body))).toMatchObject({
      fen: 'startpos-fen',
      history: ['e2e4'],
      repertoire_id: 'white_italian',
      top_k: 5,
      move_time_ms: 500,
    })
  })

  it('uses the bundled CPU runtime when the sidecar is not configured', async () => {
    const result = await requestStyledMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      history: [],
      repertoireId: 'white_italian',
      legalMoves: ['e2e4', 'd2d4', 'd7d5'],
      moveTimeMs: 500,
    })
    expect(result).toEqual({ move: 'e2e4', revisionId: 'builtin-styled-opening', repertoireId: 'white_italian' })
  })
})
