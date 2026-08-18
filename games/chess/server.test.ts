import { describe, expect, it } from 'vitest'
import { chessServerGame } from './server'
import { DEFAULT_CHESS_TIME_ID } from './time-control'

const host = { id: 'white-player', name: 'White' }
const guest = { id: 'black-player', name: 'Black' }
const random = { int: (min: number) => min }
const createContext = { host, now: new Date('2026-01-01T00:00:00Z'), random }
const startNow = new Date('2026-01-01T00:00:00Z')
const actionContext = {
  actorId: host.id,
  hostId: host.id,
  players: [host, guest],
  now: startNow,
  random,
}
const GUEST_ACTION_CONTEXT = { ...actionContext, actorId: guest.id }

function started(extra: Partial<typeof actionContext> = {}) {
  return chessServerGame.reduce(
    chessServerGame.createState(createContext),
    { type: 'chess.start', hostColor: 'white', timeControlId: DEFAULT_CHESS_TIME_ID },
    { ...actionContext, ...extra },
  )
}

describe('chess server game', () => {
  it('starts a room with the host-selected color', () => {
    const initial = chessServerGame.createState(createContext)
    const started = chessServerGame.reduce(initial, { type: 'chess.start', hostColor: 'black' }, actionContext)
    expect(started.phase).toBe('active')
    expect(started.whiteId).toBe(guest.id)
    expect(started.blackId).toBe(host.id)
  })

  it('accepts legal moves and rejects moving out of turn', () => {
    const moved = chessServerGame.reduce(started(), { type: 'chess.move', from: 'e2', to: 'e4' }, actionContext)
    expect(moved.fen).not.toBe(started().fen)
    expect(() => chessServerGame.reduce(moved, { type: 'chess.move', from: 'd2', to: 'd4' }, actionContext)).toThrow('Black to move')
  })

  it('supports resignation and rematch', () => {
    const resigned = chessServerGame.reduce(started(), { type: 'chess.resign' }, actionContext)
    expect(resigned.phase).toBe('finished')
    expect(resigned.result).toContain('Black wins')
    const rematch = chessServerGame.reduce(resigned, { type: 'chess.rematch' }, actionContext)
    expect(rematch.phase).toBe('active')
    expect(rematch.fen).toContain(' w ')
  })
})

describe('chess time controls', () => {
  it('starts with the chosen clock for both players', () => {
    const state = chessServerGame.reduce(
      chessServerGame.createState(createContext),
      { type: 'chess.start', hostColor: 'white', timeControlId: 'rapid-10' },
      actionContext,
    )
    expect(state.timeControlId).toBe('rapid-10')
    expect(state.whiteClockMs).toBe(10 * 60 * 1000)
    expect(state.blackClockMs).toBe(10 * 60 * 1000)
  })

  it('settles the mover clock and adds increment on a quick move', () => {
    // Black plays 60 seconds after white's clock started ticking.
    const state = started()
    const after60s = chessServerGame.reduce(
      state,
      { type: 'chess.move', from: 'e2', to: 'e4' },
      { ...actionContext, now: new Date(startNow.getTime() + 60_000) },
    )
    // 10+0 control: white used 60s, no increment → 270s left.
    expect(after60s.whiteClockMs).toBeLessThan(300_000)
    // The turn switched to black, so black's frozen clock is still full.
    expect(after60s.blackClockMs).toBe(300_000)
    // clockStartedAtMs advanced to the moment black's turn began.
    expect(after60s.clockStartedAtMs).toBe(startNow.getTime() + 60_000)
  })

  it('gives the mover an increment when the control allows it', () => {
    const initial = chessServerGame.createState(createContext)
    const state = chessServerGame.reduce(
      initial,
      { type: 'chess.start', hostColor: 'white', timeControlId: 'rapid-15-10' },
      actionContext,
    )
    // White moves after 60s on a 15+10 control → 900-60+10 = 850s left.
    const moved = chessServerGame.reduce(
      state,
      { type: 'chess.move', from: 'e2', to: 'e4' },
      { ...actionContext, now: new Date(startNow.getTime() + 60_000) },
    )
    expect(moved.whiteClockMs).toBe(850_000)
  })

  it('declares the mover the loser when their flag falls mid-move', () => {
    const state = started()
    const afterTimeout = chessServerGame.reduce(
      state,
      { type: 'chess.move', from: 'e2', to: 'e4' },
      { ...actionContext, now: new Date(startNow.getTime() + 301_000) },
    )
    expect(afterTimeout.phase).toBe('finished')
    expect(afterTimeout.result).toBe('Black wins on time')
  })

  it('lets the opponent claim a timeout when the active side\'s clock expires', () => {
    const state = started()
    const claimed = chessServerGame.reduce(
      state,
      { type: 'chess.timeout' },
      { ...GUEST_ACTION_CONTEXT, now: new Date(startNow.getTime() + 301_000) },
    )
    expect(claimed.phase).toBe('finished')
    expect(claimed.result).toBe('Black wins on time')
  })

  it('rejects a timeout claim before the clock has expired', () => {
    const state = started()
    expect(() => chessServerGame.reduce(
      state,
      { type: 'chess.timeout' },
      { ...GUEST_ACTION_CONTEXT, now: new Date(startNow.getTime() + 5_000) },
    )).toThrow('time has not yet expired')
  })

  it('keeps the time control on rematch', () => {
    const state = started({ now: startNow })
    const resigned = chessServerGame.reduce(state, { type: 'chess.resign' }, actionContext)
    const rematch = chessServerGame.reduce(resigned, { type: 'chess.rematch' }, actionContext)
    expect(rematch.timeControlId).toBe(DEFAULT_CHESS_TIME_ID)
    expect(rematch.whiteClockMs).toBe(5 * 60 * 1000)
  })

  it('defaults to a known time control when none is supplied', () => {
    const state = chessServerGame.reduce(
      chessServerGame.createState(createContext),
      { type: 'chess.start', hostColor: 'white' },
      actionContext,
    )
    expect(state.timeControlId).toBe(DEFAULT_CHESS_TIME_ID)
  })
})