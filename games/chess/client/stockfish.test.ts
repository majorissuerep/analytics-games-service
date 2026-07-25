import { describe, expect, it } from 'vitest'
import { STOCKFISH_LEVELS, buildStockfishSearchCommands, parseBestMove } from './stockfish'

describe('Stockfish 18 browser engine', () => {
  it('offers five real difficulty profiles with increasing strength and think time', () => {
    expect(STOCKFISH_LEVELS.map((level) => level.id)).toEqual(['beginner', 'casual', 'club', 'advanced', 'expert'])
    expect(STOCKFISH_LEVELS.map((level) => level.skill)).toEqual([0, 5, 10, 15, 20])
    expect(STOCKFISH_LEVELS.map((level) => level.moveTimeMs)).toEqual([100, 200, 350, 600, 1000])
  })

  it('builds UCI commands for the requested position and difficulty', () => {
    expect(buildStockfishSearchCommands('test-fen', 'club')).toEqual([
      'stop',
      'setoption name Skill Level value 10',
      'position fen test-fen',
      'go movetime 350',
    ])
  })

  it('parses normal and promotion best moves', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toEqual({ from: 'e2', to: 'e4', promotion: undefined })
    expect(parseBestMove('bestmove a7a8q')).toEqual({ from: 'a7', to: 'a8', promotion: 'q' })
    expect(parseBestMove('info depth 4')).toBeNull()
  })
})
