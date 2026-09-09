import { describe, expect, it } from 'vitest'
import {
  STOCKFISH_ENGINES,
  STOCKFISH_LEVELS,
  buildStockfishEvaluationCommands,
  buildStockfishSearchCommands,
  buildStockfishTimedSearchCommands,
  parseBestMove,
  parseInfoEvaluation,
  stockfishEngineIdForRevision,
} from './stockfish'

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

  it('builds a full-strength three-second arena search', () => {
    expect(buildStockfishTimedSearchCommands('test-fen', 3000)).toEqual([
      'stop',
      'setoption name Skill Level value 20',
      'position fen test-fen',
      'go movetime 3000',
    ])
  })

  it('parses normal and promotion best moves', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toEqual({ from: 'e2', to: 'e4', promotion: undefined })
    expect(parseBestMove('bestmove a7a8q')).toEqual({ from: 'a7', to: 'a8', promotion: 'q' })
    expect(parseBestMove('info depth 4')).toBeNull()
  })

  it('exposes Stockfish 18 and Stockfish 19 browser engines', () => {
    expect(STOCKFISH_ENGINES.map((engine) => engine.id)).toEqual(['stockfish-18', 'stockfish-19'])
    expect(stockfishEngineIdForRevision('builtin-stockfish-18')).toBe('stockfish-18')
    expect(stockfishEngineIdForRevision('builtin-stockfish-19')).toBe('stockfish-19')
    expect(stockfishEngineIdForRevision('builtin-styled-opening')).toBeNull()
  })

  it('builds a full-strength evaluation search', () => {
    expect(buildStockfishEvaluationCommands('test-fen', 250)).toEqual([
      'stop',
      'setoption name Skill Level value 20',
      'position fen test-fen',
      'go movetime 250',
    ])
  })

  it('converts UCI scores to the white perspective', () => {
    expect(parseInfoEvaluation('info depth 12 score cp 34 nodes 100 pv e2e4', 'w')).toEqual({ scoreCp: 34, mate: null, depth: 12 })
    expect(parseInfoEvaluation('info depth 20 score mate 3 nodes 100 pv e2e4', 'b')).toEqual({ scoreCp: -100000, mate: -3, depth: 20 })
    expect(parseInfoEvaluation('info depth 4 nodes 100 pv e2e4', 'w')).toBeNull()
  })
})
