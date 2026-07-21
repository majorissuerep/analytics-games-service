import { describe, expect, it } from 'vitest'
import { EngineError } from '@/lib/engine/errors'
import type { EnginePlayer } from '@/lib/engine/types'
import type { GameActionContext, RandomSource } from '@/lib/engine/server/contracts'
import { scoreFor, type ConsensusGameState } from './model'
import { consensusRadarServerGame } from './server'

const players: EnginePlayer[] = [
  { id: 'host', name: 'Host' },
  { id: 'alpha-guess', name: 'Alpha guesser' },
  { id: 'beta-clue', name: 'Beta clue-giver' },
  { id: 'beta-guess', name: 'Beta guesser' },
]

const random: RandomSource = {
  int(minInclusive) {
    return minInclusive
  },
}

function context(actorId: string): GameActionContext {
  return {
    actorId,
    hostId: 'host',
    players,
    now: new Date('2026-07-21T12:00:00Z'),
    random,
  }
}

function setupLobby() {
  let state = consensusRadarServerGame.createState({
    host: players[0],
    now: new Date('2026-07-21T12:00:00Z'),
    random,
  })
  const act = (actorId: string, action: unknown) => {
    state = consensusRadarServerGame.reduce(state, action, context(actorId))
  }

  act('alpha-guess', { type: 'consensus.team.assign', teamIndex: 0 })
  act('beta-clue', { type: 'consensus.team.assign', teamIndex: 1 })
  act('beta-guess', { type: 'consensus.team.assign', teamIndex: 1 })
  act('host', { type: 'consensus.cluegiver.assign', teamIndex: 0 })
  act('beta-clue', { type: 'consensus.cluegiver.assign', teamIndex: 1 })
  return { get state() { return state }, act }
}

describe('Consensus Radar server game', () => {
  it('keeps secret target out of non-clue-giver projections', () => {
    const lobby = setupLobby()
    lobby.act('host', {
      type: 'consensus.game.start',
      teamNames: ['Alpha', 'Beta'],
      numTeams: 2,
      roundsPerTeam: 1,
      timerSecs: 0,
    })

    const clueView = consensusRadarServerGame.project(lobby.state, {
      viewerId: 'host',
      hostId: 'host',
      players,
    })
    const guesserView = consensusRadarServerGame.project(lobby.state, {
      viewerId: 'alpha-guess',
      hostId: 'host',
      players,
    })

    expect(clueView.round?.target).toBe(8)
    expect(guesserView.round?.target).toBeNull()

    lobby.act('host', { type: 'consensus.clue.submit', clue: 'careful rollout' })
    lobby.act('alpha-guess', { type: 'consensus.guess.lock', guess: 8 })

    const outsiderView = consensusRadarServerGame.project(lobby.state, {
      viewerId: 'beta-clue',
      hostId: 'host',
      players,
    })
    expect(outsiderView.round?.target).toBeNull()
    expect(outsiderView.round?.guesses).toEqual({})
    expect(outsiderView.round?.locked['alpha-guess']).toBe(true)
  })

  it('runs complete rounds and computes leaderboard score on server', () => {
    const lobby = setupLobby()
    lobby.act('host', {
      type: 'consensus.game.start',
      teamNames: ['Alpha', 'Beta'],
      numTeams: 2,
      roundsPerTeam: 1,
      timerSecs: 30,
    })
    lobby.act('host', { type: 'consensus.clue.submit', clue: 'zero-risk deploy' })
    lobby.act('alpha-guess', { type: 'consensus.guess.lock', guess: 8 })
    lobby.act('host', { type: 'consensus.round.reveal' })

    expect(lobby.state.phase).toBe('result')
    expect(lobby.state.scores).toEqual([10, 0])
    expect(lobby.state.round?.guesses.__avg).toBe(8)

    lobby.act('host', { type: 'consensus.round.next' })
    lobby.act('beta-clue', { type: 'consensus.clue.submit', clue: 'chaos' })
    lobby.act('beta-guess', { type: 'consensus.guess.lock', guess: 30 })
    lobby.act('host', { type: 'consensus.round.reveal' })
    lobby.act('host', { type: 'consensus.round.next' })

    expect(lobby.state.phase).toBe('final')
    const entry = consensusRadarServerGame.leaderboardEntry(lobby.state, {
      viewerId: 'alpha-guess',
      hostId: 'host',
      players,
    })
    expect(entry).toMatchObject({ name: 'Alpha guesser', score: 10, rounds: 2 })
  })

  it('rejects host-only actions from ordinary players', () => {
    const state = consensusRadarServerGame.createState({
      host: players[0],
      now: new Date(),
      random,
    })
    expect(() => consensusRadarServerGame.reduce(
      state,
      {
        type: 'consensus.lobby.configure',
        teamNames: ['A', 'B'],
        numTeams: 2,
        roundsPerTeam: 3,
        timerSecs: 0,
      },
      context('alpha-guess'),
    )).toThrowError(EngineError)
  })

  it.each([
    [8, 8, 10],
    [12, 8, 5],
    [20, 8, 3],
    [90, 8, -2],
    [30, 8, 0],
  ])('scores guess %i against target %i as %i', (guess, target, points) => {
    expect(scoreFor(guess, target).pts).toBe(points)
  })

  it('produces JSON-safe state', () => {
    const lobby = setupLobby()
    expect(() => JSON.parse(JSON.stringify(lobby.state satisfies ConsensusGameState))).not.toThrow()
  })
})
