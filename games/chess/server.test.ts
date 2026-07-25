import { describe, expect, it } from 'vitest'
import { chessServerGame } from './server'

const host = { id: 'white-player', name: 'White' }
const guest = { id: 'black-player', name: 'Black' }
const random = { int: (min: number) => min }
const createContext = { host, now: new Date('2026-01-01T00:00:00Z'), random }
const actionContext = {
  actorId: host.id,
  hostId: host.id,
  players: [host, guest],
  now: new Date('2026-01-01T00:00:00Z'),
  random,
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
    const initial = chessServerGame.createState(createContext)
    const started = chessServerGame.reduce(initial, { type: 'chess.start', hostColor: 'white' }, actionContext)
    const moved = chessServerGame.reduce(started, { type: 'chess.move', from: 'e2', to: 'e4' }, actionContext)
    expect(moved.fen).not.toBe(started.fen)
    expect(() => chessServerGame.reduce(moved, { type: 'chess.move', from: 'd2', to: 'd4' }, actionContext)).toThrow('Black to move')
  })

  it('supports resignation and rematch', () => {
    const started = chessServerGame.reduce(
      chessServerGame.createState(createContext),
      { type: 'chess.start', hostColor: 'white' },
      actionContext,
    )
    const resigned = chessServerGame.reduce(started, { type: 'chess.resign' }, actionContext)
    expect(resigned.phase).toBe('finished')
    expect(resigned.result).toContain('Black wins')
    const rematch = chessServerGame.reduce(resigned, { type: 'chess.rematch' }, actionContext)
    expect(rematch.phase).toBe('active')
    expect(rematch.fen).toContain(' w ')
  })
})
