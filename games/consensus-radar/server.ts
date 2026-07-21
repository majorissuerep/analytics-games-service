import { EngineError } from '@/lib/engine/errors'
import type {
  CreateGameContext,
  GameActionContext,
  ProjectGameContext,
  ServerGame,
} from '@/lib/engine/server/contracts'
import { consensusRadarManifest } from './manifest'
import {
  type ConsensusAction,
  type ConsensusGameState,
  type ConsensusGameView,
  type ConsensusRoundState,
  scoreFor,
} from './model'
import { SCALES } from './scales'

const TEAM_MIN = 2
const TEAM_MAX = 4
const ROUND_MIN = 1
const ROUND_MAX = 10
const TIMER_OPTIONS = new Set([0, 30, 60, 120, 300])

function invalid(message: string): never {
  throw new EngineError('INVALID_ACTION', message, 400)
}

function forbidden(message: string): never {
  throw new EngineError('FORBIDDEN', message, 403)
}

function assertHost(context: GameActionContext) {
  if (context.actorId !== context.hostId) forbidden('Only room host can perform this action')
}

function assertLobby(state: ConsensusGameState) {
  if (state.phase !== 'lobby') invalid('This action is only available in lobby')
}

function isConsensusAction(action: unknown): action is ConsensusAction {
  return Boolean(action && typeof action === 'object' && 'type' in action && typeof action.type === 'string')
}

function requiredInt(value: unknown, name: string): number {
  if (!Number.isInteger(value)) invalid(`${name} must be an integer`)
  return value as number
}

function normalizeConfig(
  state: ConsensusGameState,
  input: {
    teamNames: unknown
    numTeams: unknown
    roundsPerTeam: unknown
    timerSecs: unknown
  },
): ConsensusGameState {
  const numTeams = requiredInt(input.numTeams, 'numTeams')
  const roundsPerTeam = requiredInt(input.roundsPerTeam, 'roundsPerTeam')
  const timerSecs = requiredInt(input.timerSecs, 'timerSecs')

  if (numTeams < TEAM_MIN || numTeams > TEAM_MAX) invalid(`numTeams must be ${TEAM_MIN}–${TEAM_MAX}`)
  if (roundsPerTeam < ROUND_MIN || roundsPerTeam > ROUND_MAX) {
    invalid(`roundsPerTeam must be ${ROUND_MIN}–${ROUND_MAX}`)
  }
  if (!TIMER_OPTIONS.has(timerSecs)) invalid('Unsupported timer option')
  if (!Array.isArray(input.teamNames)) invalid('teamNames must be an array')
  const teamNames = input.teamNames

  const teams = Array.from({ length: numTeams }, (_, index) =>
    String(teamNames[index] ?? '')
      .trim()
      .slice(0, 32),
  )
  const playerTeams = Object.fromEntries(
    Object.entries(state.playerTeams).map(([playerId, teamIndex]) => [
      playerId,
      teamIndex >= 0 && teamIndex < numTeams ? teamIndex : -1,
    ]),
  )
  const cluegivers = Object.fromEntries(
    Object.entries(state.cluegivers).filter(([teamIndex, playerId]) => {
      const parsedTeamIndex = Number(teamIndex)
      return parsedTeamIndex < numTeams && playerTeams[playerId] === parsedTeamIndex
    }),
  )

  return {
    ...state,
    teams,
    roundsPerTeam,
    timerSecs,
    playerTeams,
    cluegivers,
    scores: Array.from({ length: numTeams }, (_, index) => state.scores[index] ?? 0),
  }
}

function pickScale(state: ConsensusGameState, context: GameActionContext | CreateGameContext) {
  const usedScales = state.usedScales.length >= SCALES.length ? [] : state.usedScales
  const availableScales = SCALES.map((_, index) => index).filter((index) => !usedScales.includes(index))
  const scaleIndex = availableScales[context.random.int(0, availableScales.length - 1)]
  return {
    scaleIndex,
    usedScales: [...usedScales, scaleIndex],
  }
}

function createRound(
  state: ConsensusGameState,
  turnIdx: number,
  context: GameActionContext,
): { round: ConsensusRoundState; usedScales: number[] } {
  const teamIdx = state.turnOrder[turnIdx]
  const cluegiver = state.cluegivers[teamIdx]
  if (!cluegiver) invalid(`Team ${teamIdx + 1} has no clue-giver`)
  const { scaleIndex, usedScales } = pickScale(state, context)

  return {
    usedScales,
    round: {
      turnIdx,
      teamIdx,
      cluegiver,
      scaleIndex,
      target: context.random.int(8, 92),
      clue: '',
      guesses: {},
      locked: {},
      scored: false,
      timerStart: null,
    },
  }
}

function createState(context: CreateGameContext): ConsensusGameState {
  return {
    phase: 'lobby',
    teams: ['', ''],
    roundsPerTeam: 3,
    timerSecs: 0,
    playerTeams: { [context.host.id]: 0 },
    cluegivers: {},
    usedScales: [],
    turnOrder: [],
    turnPtr: 0,
    scores: [0, 0],
    round: null,
  }
}

function reduce(
  state: ConsensusGameState,
  rawAction: unknown,
  context: GameActionContext,
): ConsensusGameState {
  if (!isConsensusAction(rawAction)) invalid('Action must include a type')
  const action = rawAction as ConsensusAction

  switch (action.type) {
    case 'consensus.team.assign': {
      assertLobby(state)
      const teamIndex = requiredInt(action.teamIndex, 'teamIndex')
      if (teamIndex < 0 || teamIndex >= state.teams.length) invalid('Team does not exist')
      if (!context.players.some((player) => player.id === context.actorId)) forbidden('Player has not joined room')

      const cluegivers = Object.fromEntries(
        Object.entries(state.cluegivers).filter(([, playerId]) => playerId !== context.actorId),
      )
      return {
        ...state,
        playerTeams: { ...state.playerTeams, [context.actorId]: teamIndex },
        cluegivers,
      }
    }

    case 'consensus.cluegiver.assign': {
      assertLobby(state)
      const teamIndex = requiredInt(action.teamIndex, 'teamIndex')
      if (state.playerTeams[context.actorId] !== teamIndex) {
        forbidden('Join this team before becoming its clue-giver')
      }
      return {
        ...state,
        cluegivers: { ...state.cluegivers, [teamIndex]: context.actorId },
      }
    }

    case 'consensus.lobby.configure': {
      assertHost(context)
      assertLobby(state)
      return normalizeConfig(state, action)
    }

    case 'consensus.game.start': {
      assertHost(context)
      assertLobby(state)
      if (context.players.length < consensusRadarManifest.minPlayers) {
        invalid(`Consensus Radar needs at least ${consensusRadarManifest.minPlayers} players`)
      }
      const configured = normalizeConfig(state, action)

      for (let teamIndex = 0; teamIndex < configured.teams.length; teamIndex += 1) {
        const cluegiver = configured.cluegivers[teamIndex]
        if (!cluegiver || configured.playerTeams[cluegiver] !== teamIndex) {
          invalid(`Team ${teamIndex + 1} needs a clue-giver`)
        }
      }

      const teams = configured.teams.map((name, index) => name || `Team ${index + 1}`)
      const turnOrder = Array.from(
        { length: configured.roundsPerTeam * teams.length },
        (_, index) => index % teams.length,
      )
      const stateWithOrder: ConsensusGameState = {
        ...configured,
        teams,
        phase: 'cluegiver',
        turnOrder,
        turnPtr: 0,
        usedScales: [],
        scores: teams.map(() => 0),
      }
      const firstRound = createRound(stateWithOrder, 0, context)
      return {
        ...stateWithOrder,
        ...firstRound,
      }
    }

    case 'consensus.clue.submit': {
      if (state.phase !== 'cluegiver' || !state.round) invalid('No clue is expected now')
      if (state.round.cluegiver !== context.actorId) forbidden('Only current clue-giver can submit clue')
      const clue = typeof action.clue === 'string' ? action.clue.trim().slice(0, 100) : ''
      if (!clue) invalid('Clue cannot be empty')
      return {
        ...state,
        phase: 'guessing',
        round: {
          ...state.round,
          clue,
          timerStart: state.timerSecs > 0 ? context.now.getTime() : null,
        },
      }
    }

    case 'consensus.guess.lock': {
      if (state.phase !== 'guessing' || !state.round) invalid('No guess is expected now')
      if (state.playerTeams[context.actorId] !== state.round.teamIdx) forbidden('Current team only')
      if (state.round.cluegiver === context.actorId) forbidden('Clue-giver cannot guess')
      if (state.round.locked[context.actorId]) invalid('Guess is already locked')
      const guess = requiredInt(action.guess, 'guess')
      if (guess < 0 || guess > 100) invalid('guess must be between 0 and 100')
      return {
        ...state,
        round: {
          ...state.round,
          guesses: { ...state.round.guesses, [context.actorId]: guess },
          locked: { ...state.round.locked, [context.actorId]: true },
        },
      }
    }

    case 'consensus.round.reveal': {
      assertHost(context)
      if (state.phase !== 'guessing' || !state.round) invalid('Round cannot be revealed now')
      if (state.round.scored) invalid('Round was already scored')

      const teamPlayers = context.players.filter(
        (player) => state.playerTeams[player.id] === state.round?.teamIdx,
      )
      const guesses = teamPlayers
        .filter((player) => player.id !== state.round?.cluegiver && state.round?.guesses[player.id] != null)
        .map((player) => state.round?.guesses[player.id] as number)
      const firstGuess = Object.values(state.round.guesses)[0]
      const averageGuess = guesses.length
        ? Math.round(guesses.reduce((total, guess) => total + guess, 0) / guesses.length)
        : (firstGuess ?? 50)
      const result = scoreFor(averageGuess, state.round.target)
      const scores = state.scores.map((score, index) =>
        index === state.round?.teamIdx ? score + result.pts : score,
      )

      return {
        ...state,
        phase: 'result',
        scores,
        round: {
          ...state.round,
          guesses: { ...state.round.guesses, __avg: averageGuess },
          scored: true,
        },
      }
    }

    case 'consensus.round.next': {
      assertHost(context)
      if (state.phase !== 'result' || !state.round?.scored) invalid('Current result must be shown first')
      const nextTurn = state.turnPtr + 1
      if (nextTurn >= state.turnOrder.length) {
        return { ...state, phase: 'final', turnPtr: nextTurn }
      }
      const nextRound = createRound(state, nextTurn, context)
      return {
        ...state,
        ...nextRound,
        phase: 'cluegiver',
        turnPtr: nextTurn,
      }
    }

    case 'consensus.game.reset': {
      assertHost(context)
      if (state.phase !== 'final') invalid('Finish current game before resetting')
      return {
        ...state,
        phase: 'lobby',
        usedScales: [],
        turnOrder: [],
        turnPtr: 0,
        scores: state.teams.map(() => 0),
        round: null,
      }
    }

    default:
      invalid(`Unsupported Consensus Radar action: ${(action as { type: string }).type}`)
  }
}

function project(state: ConsensusGameState, context: ProjectGameContext): ConsensusGameView {
  if (!state.round) return { ...state, round: null }

  const revealTarget =
    state.phase === 'result' ||
    state.phase === 'final' ||
    (state.phase === 'cluegiver' && state.round.cluegiver === context.viewerId)
  const revealGuesses = state.phase === 'result' || state.phase === 'final'
  const guesses = revealGuesses
    ? state.round.guesses
    : state.round.guesses[context.viewerId] == null
      ? {}
      : { [context.viewerId]: state.round.guesses[context.viewerId] }

  return {
    ...state,
    round: {
      turnIdx: state.round.turnIdx,
      teamIdx: state.round.teamIdx,
      cluegiver: state.round.cluegiver,
      scale: SCALES[state.round.scaleIndex],
      target: revealTarget ? state.round.target : null,
      clue: state.round.clue,
      guesses,
      locked: state.round.locked,
      scored: state.round.scored,
      timerStart: state.round.timerStart,
    },
  }
}

export const consensusRadarServerGame: ServerGame<ConsensusGameState, ConsensusGameView> = {
  manifest: consensusRadarManifest,
  createState,
  reduce,
  project,
  leaderboardEntry(state, context) {
    if (state.phase !== 'final') invalid('Game must be finished before score submission')
    const player = context.players.find((candidate) => candidate.id === context.viewerId)
    if (!player) forbidden('Player has not joined room')
    return {
      playerId: player.id,
      name: player.name,
      score: Math.max(...state.scores),
      rounds: state.roundsPerTeam * state.teams.length,
      metadata: { teams: state.teams, scores: state.scores },
    }
  },
}
