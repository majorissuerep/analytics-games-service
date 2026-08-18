import { describe, expect, it } from 'vitest'
import { EngineError } from '@/lib/engine/errors'
import type { EnginePlayer } from '@/lib/engine/types'
import type { GameActionContext, ProjectGameContext, RandomSource } from '@/lib/engine/server/contracts'
import {
  averageMarker,
  betIsCorrect,
  nextStaffedTeamIndex,
  pickClueGiver,
  scoreFor,
  type ConsensusGameState,
} from './model'
import { consensusRadarServerGame } from './server'

const players: EnginePlayer[] = [
  { id: 'host', name: 'Host' },
  { id: 'alpha-two', name: 'Alpha Two' },
  { id: 'beta-one', name: 'Beta One' },
  { id: 'beta-two', name: 'Beta Two' },
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

function view(state: ConsensusGameState, viewerId: string) {
  const contextView: ProjectGameContext = { viewerId, hostId: 'host', players }
  return consensusRadarServerGame.project(state, contextView)
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

  act('alpha-two', { type: 'consensus.team.assign', teamIndex: 0 })
  act('beta-one', { type: 'consensus.team.assign', teamIndex: 1 })
  act('beta-two', { type: 'consensus.team.assign', teamIndex: 1 })
  return { get state() { return state }, act }
}

function startGame(lobby: ReturnType<typeof setupLobby>, goal = 0) {
  lobby.act('host', {
    type: 'consensus.game.start',
    teamNames: ['Alpha', 'Beta'],
    numTeams: 2,
    categories: ['general', 'analytics'],
    goal,
    betsEnabled: true,
  })
}

describe('Consensus Radar rules', () => {
  it.each([
    [5, 5, 5],
    [10, 5, 5],
    [17, 5, 3],
    [45, 5, 0],
    [90, 5, -2],
  ])('scores marker %i against target %i as %i', (marker, target, points) => {
    expect(scoreFor(target, marker).pts).toBe(points)
  })

  it('averages markers to one decimal and defaults to 50', () => {
    expect(averageMarker([])).toBe(50)
    expect(averageMarker([10, 11])).toBe(10.5)
    expect(averageMarker([1, 2, 2])).toBe(1.7)
  })

  it('resolves bets, treating dead centre as correct for everyone', () => {
    expect(betIsCorrect(50, 40, 'left')).toBe(true)
    expect(betIsCorrect(50, 40, 'right')).toBe(false)
    expect(betIsCorrect(50, 60, 'right')).toBe(true)
    expect(betIsCorrect(50, 50, 'left')).toBe(true)
    expect(betIsCorrect(50, 50, 'right')).toBe(true)
  })

  it('rotates the clue-giver by fewest turns, ties broken by join order', () => {
    expect(pickClueGiver(['a', 'b', 'c'], {})).toBe('a')
    expect(pickClueGiver(['a', 'b', 'c'], { a: 1 })).toBe('b')
    expect(pickClueGiver(['a', 'b', 'c'], { a: 1, b: 1 })).toBe('c')
    expect(pickClueGiver(['a', 'b'], { a: 0, b: 0 })).toBe('a')
    expect(pickClueGiver([], {})).toBeNull()
  })

  it('skips empty teams when advancing turns', () => {
    const teams = [{ name: 'A', score: 0 }, { name: 'B', score: 0 }, { name: 'C', score: 0 }]
    const playerTeams = { p1: 0, p2: 2 }
    expect(nextStaffedTeamIndex(teams, playerTeams, 0)).toBe(2)
    expect(nextStaffedTeamIndex(teams, playerTeams, 2)).toBe(0)
    expect(nextStaffedTeamIndex(teams, {}, 0)).toBeNull()
  })
})

describe('Consensus Radar server game', () => {
  it('keeps the secret target and hidden picks out of projections', () => {
    const lobby = setupLobby()
    startGame(lobby)

    // Random stub returns the lower bound: target is always 5.
    expect(lobby.state.round?.target).toBe(5)
    expect(view(lobby.state, 'host').round?.target).toBe(5) // clue-giver
    expect(view(lobby.state, 'alpha-two').round?.target).toBeNull()
    expect(view(lobby.state, 'beta-one').round?.target).toBeNull()

    lobby.act('host', { type: 'consensus.clue.submit', clue: 'careful rollout' })
    lobby.act('alpha-two', { type: 'consensus.guess.submit', value: 40 })

    const outsider = view(lobby.state, 'beta-one')
    expect(outsider.round?.target).toBeNull()
    expect(outsider.round?.guesses).toEqual({}) // values hidden
    expect(outsider.round?.guessed).toEqual(['alpha-two']) // actees visible

    const owner = view(lobby.state, 'alpha-two')
    expect(owner.round?.guesses).toEqual({ 'alpha-two': 40 })

    lobby.act('beta-one', { type: 'consensus.bet.submit', side: 'left' })
    const betHidden = view(lobby.state, 'alpha-two')
    expect(betHidden.round?.bets).toEqual({ 'beta-one': null }) // side hidden
  })

  it('rejects clues with digits and empty clues', () => {
    const lobby = setupLobby()
    startGame(lobby)
    expect(() => lobby.act('host', { type: 'consensus.clue.submit', clue: 'about 50 percent' }))
      .toThrowError(EngineError)
    expect(() => lobby.act('host', { type: 'consensus.clue.submit', clue: '   ' }))
      .toThrowError(EngineError)
    expect(lobby.state.phase).toBe('clue')
  })

  it('auto-reveals once every guesser and bettor has acted, scoring bands and bets', () => {
    const lobby = setupLobby()
    startGame(lobby)

    lobby.act('host', { type: 'consensus.clue.submit', clue: 'zero-risk deploy' })
    lobby.act('alpha-two', { type: 'consensus.guess.submit', value: 50 })
    expect(lobby.state.phase).toBe('guess') // bettors still pending

    lobby.act('beta-one', { type: 'consensus.bet.submit', side: 'right' })
    expect(lobby.state.phase).toBe('guess')
    lobby.act('beta-two', { type: 'consensus.bet.submit', side: 'right' })

    expect(lobby.state.phase).toBe('reveal')
    expect(lobby.state.round?.marker).toBe(50)
    expect(lobby.state.round?.distance).toBe(45)
    expect(lobby.state.round?.points).toBe(-2)
    // Both bettors called the correct side (marker 50 > target 5): Beta gets +1.
    expect(lobby.state.teams.map((team) => team.score)).toEqual([-2, 1])

    const revealed = view(lobby.state, 'beta-one')
    expect(revealed.round?.target).toBe(5)
    expect(revealed.round?.guesses).toEqual({ 'alpha-two': 50 })
    expect(revealed.round?.bets).toEqual({ 'beta-one': 'right', 'beta-two': 'right' })
  })

  it('rotates teams and clue-givers across rounds', () => {
    const lobby = setupLobby()
    startGame(lobby)

    // Round 1: Alpha plays, host gives the clue (join-order tie).
    expect(lobby.state.round?.teamIdx).toBe(0)
    expect(lobby.state.round?.cluegiver).toBe('host')

    lobby.act('host', { type: 'consensus.clue.submit', clue: 'careful' })
    lobby.act('alpha-two', { type: 'consensus.guess.submit', value: 5 })
    lobby.act('beta-one', { type: 'consensus.bet.submit', side: 'left' })
    lobby.act('beta-two', { type: 'consensus.bet.submit', side: 'right' })
    expect(lobby.state.phase).toBe('reveal')

    lobby.act('host', { type: 'consensus.round.next' })
    expect(lobby.state.round?.teamIdx).toBe(1)
    expect(lobby.state.round?.cluegiver).toBe('beta-one')

    lobby.act('beta-one', { type: 'consensus.clue.submit', clue: 'chaos' })
    lobby.act('beta-two', { type: 'consensus.guess.submit', value: 8 })
    lobby.act('host', { type: 'consensus.bet.submit', side: 'left' })
    lobby.act('alpha-two', { type: 'consensus.bet.submit', side: 'right' })
    expect(lobby.state.phase).toBe('reveal')

    // Round 3: back to Alpha; alpha-two has fewer clue turns than host.
    lobby.act('host', { type: 'consensus.round.next' })
    expect(lobby.state.round?.teamIdx).toBe(0)
    expect(lobby.state.round?.cluegiver).toBe('alpha-two')
  })

  it('lets a guesser change their marker before the reveal', () => {
    const lobby = setupLobby()
    startGame(lobby)
    lobby.act('host', { type: 'consensus.clue.submit', clue: 'careful' })
    lobby.act('alpha-two', { type: 'consensus.guess.submit', value: 90 })
    lobby.act('alpha-two', { type: 'consensus.guess.submit', value: 7 })
    expect(lobby.state.round?.guesses['alpha-two']).toBe(7)
  })

  it('enforces round permissions', () => {
    const lobby = setupLobby()
    startGame(lobby)

    expect(() => lobby.act('alpha-two', { type: 'consensus.clue.submit', clue: 'nope' }))
      .toThrowError(EngineError) // not the clue-giver
    lobby.act('host', { type: 'consensus.clue.submit', clue: 'careful' })
    expect(() => lobby.act('host', { type: 'consensus.guess.submit', value: 10 }))
      .toThrowError(EngineError) // clue-giver cannot guess
    expect(() => lobby.act('beta-one', { type: 'consensus.guess.submit', value: 10 }))
      .toThrowError(EngineError) // wrong team guesses
    expect(() => lobby.act('alpha-two', { type: 'consensus.bet.submit', side: 'left' }))
      .toThrowError(EngineError) // active team cannot bet
    expect(() => lobby.act('beta-one', { type: 'consensus.round.reveal' }))
      .toThrowError(EngineError) // random player cannot force reveal
    expect(() => lobby.act('host', { type: 'consensus.round.reveal' })).not.toThrow()
  })

  it('lets the clue-giver force the reveal', () => {
    const lobby = setupLobby()
    startGame(lobby)
    lobby.act('host', { type: 'consensus.clue.submit', clue: 'careful' })
    lobby.act('host', { type: 'consensus.round.reveal' })
    expect(lobby.state.phase).toBe('reveal')
    expect(lobby.state.round?.marker).toBe(50) // no guesses: averageMarker default
  })

  it('rejects host-only actions from ordinary players', () => {
    const lobby = setupLobby()
    expect(() => lobby.act('alpha-two', { type: 'consensus.lobby.configure', goal: 15 }))
      .toThrowError(EngineError)
    expect(() => lobby.act('alpha-two', { type: 'consensus.game.start' }))
      .toThrowError(EngineError)
  })

  it('needs two staffed teams to start', () => {
    let state = consensusRadarServerGame.createState({
      host: players[0],
      now: new Date(),
      random,
    })
    expect(() => {
      state = consensusRadarServerGame.reduce(state, { type: 'consensus.game.start' }, context('host'))
    }).toThrowError(EngineError)
    expect(state.phase).toBe('lobby')
  })

  it('finishes when a team reaches the goal and reports the leader', () => {
    const lobby = setupLobby()
    startGame(lobby, 15)

    // Craft the state to sit one reveal away from the goal.
    lobby.act('host', { type: 'consensus.clue.submit', clue: 'careful' })
    lobby.act('alpha-two', { type: 'consensus.guess.submit', value: 5 })
    lobby.act('beta-one', { type: 'consensus.bet.submit', side: 'left' })
    lobby.act('beta-two', { type: 'consensus.bet.submit', side: 'left' })

    const nearGoal: ConsensusGameState = {
      ...lobby.state,
      phase: 'guess',
      goal: 15,
      teams: [
        { name: 'Alpha', score: 11 },
        { name: 'Beta', score: 0 },
      ],
      round: lobby.state.round
        ? { ...lobby.state.round, guesses: { 'alpha-two': 5 }, bets: {} }
        : null,
    }

    const finished = consensusRadarServerGame.reduce(
      nearGoal,
      { type: 'consensus.round.reveal' },
      context('host'),
    )
    expect(finished.phase).toBe('finished')
    expect(finished.teams[0].score).toBe(16) // 11 + bullseye 5
    expect(finished.winnerTeamIdx).toBe(0)

    expect(() => consensusRadarServerGame.reduce(
      finished,
      { type: 'consensus.round.next' },
      context('host'),
    )).toThrowError(EngineError)

    const entry = consensusRadarServerGame.leaderboardEntry(finished, {
      viewerId: 'alpha-two',
      hostId: 'host',
      players,
    })
    expect(entry).toMatchObject({ name: 'Alpha Two', score: 16 })
  })

  it('ends the game early on host command and resets for another match', () => {
    const lobby = setupLobby()
    startGame(lobby)
    lobby.act('host', { type: 'consensus.game.end' })
    expect(lobby.state.phase).toBe('finished')
    expect(lobby.state.winnerTeamIdx).not.toBeNull()

    lobby.act('host', { type: 'consensus.game.reset' })
    expect(lobby.state.phase).toBe('lobby')
    expect(lobby.state.round).toBeNull()
    expect(lobby.state.roundNo).toBe(0)
    expect(lobby.state.clueTurns).toEqual({})
    expect(lobby.state.teams.every((team) => team.score === 0)).toBe(true)
  })

  it('produces JSON-safe state', () => {
    const lobby = setupLobby()
    startGame(lobby)
    expect(() => JSON.parse(JSON.stringify(lobby.state satisfies ConsensusGameState))).not.toThrow()
  })
})
