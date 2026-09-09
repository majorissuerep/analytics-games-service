import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { boardTensorFromFen, predictStyledMove } from './styled-node-runtime'

function legalMoves(fen: string) {
  return new Chess(fen).moves({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion ?? ''}`)
}

describe('bundled styled CPU runtime', () => {
  it('encodes the canonical initial board planes', () => {
    const tensor = boardTensorFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    const sums = Array.from({ length: 18 }, (_, channel) =>
      tensor.slice(channel * 64, (channel + 1) * 64).reduce((sum, value) => sum + value, 0),
    )
    expect(sums).toEqual([8, 2, 2, 2, 1, 1, 8, 2, 2, 2, 1, 1, 64, 64, 64, 64, 0, 64])
  })

  it('mirrors black positions into the active-side canonical planes', () => {
    const tensor = boardTensorFromFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')
    expect(tensor[6 * 64 + 1 * 8]).toBe(1)
    expect(tensor[6 * 64 + 3 * 8 + 4]).toBe(1)
    expect(tensor[0 * 64 + 1 * 8]).toBe(0)
    expect(tensor[17 * 64]).toBe(0)
  })

  it('takes the selected repertoire opening move from the bundled book', async () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const result = await predictStyledMove({
      fen,
      history: [],
      repertoireId: 'white_italian',
      legalMoves: legalMoves(fen),
      moveTimeMs: 2800,
    })
    expect(result).toMatchObject({ move: 'e2e4', mode: 'opening_book', repertoireId: 'white_italian' })
  })

  it('returns a legal move from the CPU neural fallback after a deviation', async () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    const moves = legalMoves(fen)
    const result = await predictStyledMove({
      fen,
      history: [],
      repertoireId: 'white_italian',
      legalMoves: moves,
      moveTimeMs: 2800,
    })
    expect(result.mode).toBe('policy')
    expect(moves).toContain(result.move)
  })
})
