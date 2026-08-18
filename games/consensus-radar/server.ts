import { EngineError } from '@/lib/engine/errors'
import type {
  CreateGameContext,
  GameActionContext,
  ProjectGameContext,
  ServerGame,
} from '@/lib/engine/server/contracts'
import { consensusRadarManifest } from './manifest'
import {
  BET_POINTS,
  CLUE_MAX_LEN,
  GOAL_OPTIONS,
  MAX_TEAMS,
  MIN_TEAMS,
  averageMarker,
  betIsCorrect,
  clampSlider,
  cleanClue,
  cleanName,
  clueHasDigits,
  firstStaffedTeamIndex,
  leaderTeamIdx,
  nextStaffedTeamIndex,
  pickClueGiver,
  scoreFor,
  type BetSide,
  type Category,
  type ConsensusAction,
  type ConsensusGameState,
  type ConsensusGameView,
  type ConsensusRoundState,
} from './model'
import { scaleByKey, scalesForCategories, SCALES } from './scales'

const CATEGORIES: Category[] = ['general', 'analytics']
const DEFAULT_GOAL = 20

function invalid(message: string): never {
  throw new EngineError('INVALID_ACTION', message, 400)
}

function forbidden(message: string): never {
  throw new EngineError('FORBIDDEN', message, 403)
}

function assertHost(context: GameActionContext) {
  if (context.actorId !== context.hostId) forbidden('Only room host can perform this action')
}

function assertJoined(context: GameActionContext) {
  if (!context.players.some((player) => player.id === context.actorId)) {
    forbidden('Player has not joined room')
  }
}

function isConsensusAction(action: unknown): action is ConsensusAction {
  return Boolean(action && typeof action === 'object' && 'type' in action && typeof action.type === 'string')
}

function normalizeConfig(
  state: ConsensusGameState,
  input: {
    teamNames?: unknown
    numTeams?: unknown
    categories?: unknown
    goal?: unknown
    betsEnabled?: unknown
  },
): ConsensusGameState {
  let numTeams = state.teams.length
  if (input.numTeams !== undefined) {
    if (!Number.isInteger(input.numTeams)) invalid('numTeams must be an integer')
    numTeams = input.numTeams as number
    if (numTeams < MIN_TEAMS || numTeams > MAX_TEAMS) invalid(`numTeams must be ${MIN_TEAMS}–${MAX_TEAMS}`)
  }

  let teams = state.teams
  if (input.numTeams !== undefined || input.teamNames !== undefined) {
    if (input.teamNames !== undefined && !Array.isArray(input.teamNames)) invalid('teamNames must be an array')
    const names = Array.isArray(input.teamNames) ? input.teamNames : []
    teams = Array.from({ length: numTeams }, (_, index) => ({
      name:
        input.teamNames !== undefined
          ? cleanName(names[index], `Team ${index + 1}`)
          : (state.teams[index]?.name ?? `Team ${index + 1}`),
      score: state.teams[index]?.score ?? 0,
    }))
  }

  let categories = state.categories
  if (input.categories !== undefined) {
    if (!Array.isArray(input.categories)) invalid('categories must be an array')
    const wanted = CATEGORIES.filter((category) => (input.categories as unknown[]).includes(category))
    categories = wanted.length > 0 ? wanted : [...CATEGORIES]
  }

  let goal = state.goal
  if (input.goal !== undefined) {
    const parsed = Number(input.goal)
    if (!GOAL_OPTIONS.includes(parsed as (typeof GOAL_OPTIONS)[number])) invalid('Unsupported goal')
    goal = parsed
  }

  const betsEnabled = input.betsEnabled !== undefined ? input.betsEnabled !== false : state.betsEnabled

  const playerTeams = Object.fromEntries(
    Object.entries(state.playerTeams).map(([playerId, teamIndex]) => [
      playerId,
      teamIndex >= 0 && teamIndex < teams.length ? teamIndex : -1,
    ]),
  )

  return { ...state, teams, categories, goal, betsEnabled, playerTeams }
}

function pickScaleKey(state: ConsensusGameState, context: GameActionContext): string {
  const pool = scalesForCategories(state.categories)
  const fresh = pool.filter((scale) => !state.usedScaleKeys.includes(scale.key))
  const from = fresh.length > 0 ? fresh : pool
  return from[context.random.int(0, from.length - 1)].key
}

/** Team members in join order — Array.sort is stable, so ties rotate fairly. */
function teamPlayerIds(state: ConsensusGameState, context: GameActionContext, teamIdx: number): string[] {
  return context.players
    .filter((player) => state.playerTeams[player.id] === teamIdx)
    .map((player) => player.id)
}

function openRound(
  state: ConsensusGameState,
  activeTeamIdx: number,
  context: GameActionContext,
): ConsensusGameState {
  const memberIds = teamPlayerIds(state, context, activeTeamIdx)
  const cluegiver = pickClueGiver(memberIds, state.clueTurns)
  if (!cluegiver) invalid(`Team ${activeTeamIdx + 1} has no players`)

  const scaleKey = pickScaleKey(state, context)
  const roundNo = state.roundNo + 1
  const round: ConsensusRoundState = {
    roundNo,
    teamIdx: activeTeamIdx,
    cluegiver,
    scaleKey,
    target: context.random.int(5, 95),
    clue: '',
    guesses: {},
    bets: {},
    marker: null,
    distance: null,
    points: null,
    teamPoints: null,
  }

  return {
    ...state,
    phase: 'clue',
    activeTeamIdx,
    roundNo,
    round,
    usedScaleKeys: [...state.usedScaleKeys, scaleKey],
    clueTurns: { ...state.clueTurns, [cluegiver]: (state.clueTurns[cluegiver] ?? 0) + 1 },
  }
}

/** Scores the round, applies team points, and detects the goal. */
function revealRound(state: ConsensusGameState): ConsensusGameState {
  const round = state.round
  if (!round) invalid('No round in progress')

  const values = Object.values(round.guesses)
  const marker = averageMarker(values)
  const { pts } = scoreFor(round.target, marker)
  const distance = Math.round(Math.abs(round.target - marker) * 10) / 10

  // Active team gets the band score; every other staffed team gets +1 when
  // the majority of its bettors called the correct side.
  const teamPoints = state.teams.map(() => 0)
  teamPoints[round.teamIdx] = pts
  for (let teamIdx = 0; teamIdx < state.teams.length; teamIdx += 1) {
    if (teamIdx === round.teamIdx) continue
    const mine = Object.entries(round.bets).filter(
      ([playerId]) => state.playerTeams[playerId] === teamIdx,
    )
    if (mine.length === 0) continue
    const correct = mine.filter(([, side]) => betIsCorrect(round.target, marker, side)).length
    if (correct * 2 > mine.length) teamPoints[teamIdx] += BET_POINTS
  }

  const teams = state.teams.map((team, index) => ({ ...team, score: team.score + teamPoints[index] }))
  const revealed: ConsensusGameState = {
    ...state,
    teams,
    round: { ...round, marker, distance, points: pts, teamPoints },
  }

  if (state.goal > 0 && teams.some((team) => team.score >= state.goal)) {
    return { ...revealed, phase: 'finished', winnerTeamIdx: leaderTeamIdx(teams) }
  }
  return { ...revealed, phase: 'reveal' }
}

/** Reveals as soon as everyone who can act has acted. */
function maybeAutoReveal(state: ConsensusGameState, context: GameActionContext): ConsensusGameState {
  const round = state.round
  if (!round || state.phase !== 'guess') return state

  const guessers = context.players.filter(
    (player) => state.playerTeams[player.id] === round.teamIdx && player.id !== round.cluegiver,
  )
  const bettors = state.betsEnabled
    ? context.players.filter(
        (player) => state.playerTeams[player.id] >= 0 && state.playerTeams[player.id] !== round.teamIdx,
      )
    : []

  const allGuessed = guessers.length > 0 && guessers.every((player) => round.guesses[player.id] != null)
  const allBet = bettors.every((player) => round.bets[player.id] != null)

  return allGuessed && allBet ? revealRound(state) : state
}

function createState(context: CreateGameContext): ConsensusGameState {
  return {
    phase: 'lobby',
    categories: [...CATEGORIES],
    goal: DEFAULT_GOAL,
    betsEnabled: true,
    teams: [
      { name: 'Team 1', score: 0 },
      { name: 'Team 2', score: 0 },
    ],
    playerTeams: { [context.host.id]: 0 },
    clueTurns: {},
    usedScaleKeys: [],
    activeTeamIdx: 0,
    roundNo: 0,
    round: null,
    winnerTeamIdx: null,
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
      if (state.phase !== 'lobby') invalid('Teams are locked once the game starts')
      assertJoined(context)
      const teamIndex = action.teamIndex
      if (!Number.isInteger(teamIndex) || teamIndex < 0 || teamIndex >= state.teams.length) {
        invalid('Team does not exist')
      }
      return { ...state, playerTeams: { ...state.playerTeams, [context.actorId]: teamIndex } }
    }

    case 'consensus.lobby.configure': {
      assertHost(context)
      if (state.phase !== 'lobby') invalid('Settings are locked once the game starts')
      return normalizeConfig(state, action)
    }

    case 'consensus.game.start': {
      assertHost(context)
      if (state.phase !== 'lobby') invalid('The game has already started')
      const configured = normalizeConfig(state, action)

      const staffed = configured.teams.filter((_, index) =>
        Object.values(configured.playerTeams).some((teamIndex) => teamIndex === index),
      )
      if (staffed.length < 2) {
        invalid('At least two teams need a player before the game can start')
      }

      const first = firstStaffedTeamIndex(configured.teams, configured.playerTeams)
      if (first === null) invalid('At least two teams need a player before the game can start')

      const fresh: ConsensusGameState = {
        ...configured,
        teams: configured.teams.map((team) => ({ ...team, score: 0 })),
        usedScaleKeys: [],
        activeTeamIdx: first,
        roundNo: 0,
        round: null,
        winnerTeamIdx: null,
      }
      return openRound(fresh, first, context)
    }

    case 'consensus.clue.submit': {
      if (state.phase !== 'clue' || !state.round) invalid('No clue is expected now')
      if (state.round.cluegiver !== context.actorId) forbidden('Only the clue-giver can submit the clue')
      const clue = cleanClue(action.clue)
      if (!clue) invalid('The clue cannot be empty')
      if (clueHasDigits(clue)) invalid("No numbers in the clue — that's the whole game!")
      return { ...state, phase: 'guess', round: { ...state.round, clue } }
    }

    case 'consensus.guess.submit': {
      if (state.phase !== 'guess' || !state.round) invalid('Not accepting guesses right now')
      assertJoined(context)
      if (state.playerTeams[context.actorId] !== state.round.teamIdx) forbidden('Only the active team guesses')
      if (state.round.cluegiver === context.actorId) forbidden('The clue-giver does not guess')
      const value = clampSlider(action.value)
      if (value === null) invalid('Invalid marker position')
      const next: ConsensusGameState = {
        ...state,
        round: { ...state.round, guesses: { ...state.round.guesses, [context.actorId]: value } },
      }
      return maybeAutoReveal(next, context)
    }

    case 'consensus.bet.submit': {
      if (!state.betsEnabled) invalid('Side bets are disabled in this room')
      if (state.phase !== 'guess' || !state.round) invalid('Not accepting bets right now')
      assertJoined(context)
      const actorTeam = state.playerTeams[context.actorId]
      if (actorTeam == null || actorTeam < 0) forbidden('Join a team before betting')
      if (actorTeam === state.round.teamIdx) forbidden('The guessing team cannot bet')
      if (action.side !== 'left' && action.side !== 'right') invalid('Bet must be left or right')
      const next: ConsensusGameState = {
        ...state,
        round: { ...state.round, bets: { ...state.round.bets, [context.actorId]: action.side } },
      }
      return maybeAutoReveal(next, context)
    }

    case 'consensus.round.reveal': {
      if (!state.round) invalid('No round in progress')
      if (state.phase === 'clue') invalid('The clue has not been given yet')
      if (state.phase !== 'guess') invalid('Round cannot be revealed now')
      const mayReveal = context.actorId === context.hostId || context.actorId === state.round.cluegiver
      if (!mayReveal) forbidden('Only the host or the clue-giver can reveal')
      return revealRound(state)
    }

    case 'consensus.round.next': {
      if (state.phase !== 'reveal' || !state.round) invalid('The current round is not finished')
      const mayAdvance = context.actorId === context.hostId || context.actorId === state.round.cluegiver
      if (!mayAdvance) forbidden('Only the host or the clue-giver can start the next round')
      const next = nextStaffedTeamIndex(state.teams, state.playerTeams, state.activeTeamIdx)
      if (next === null) invalid('No team has any players left')
      return openRound({ ...state, round: null }, next, context)
    }

    case 'consensus.game.end': {
      assertHost(context)
      if (state.phase === 'lobby') invalid('The game has not started yet')
      if (state.phase === 'finished') invalid('The game has already finished')
      return { ...state, phase: 'finished', winnerTeamIdx: leaderTeamIdx(state.teams) }
    }

    case 'consensus.game.reset': {
      assertHost(context)
      if (state.phase !== 'finished') invalid('Finish the current game before resetting')
      return {
        ...state,
        phase: 'lobby',
        teams: state.teams.map((team) => ({ ...team, score: 0 })),
        clueTurns: {},
        usedScaleKeys: [],
        activeTeamIdx: 0,
        roundNo: 0,
        round: null,
        winnerTeamIdx: null,
      }
    }

    default:
      invalid(`Unsupported Consensus Radar action: ${(action as { type: string }).type}`)
  }
}

function project(state: ConsensusGameState, context: ProjectGameContext): ConsensusGameView {
  if (!state.round) return { ...state, round: null }

  const revealed = state.phase === 'reveal' || state.phase === 'finished'
  const seesTarget =
    revealed || (state.phase === 'clue' && state.round.cluegiver === context.viewerId)

  const guesses = revealed
    ? state.round.guesses
    : state.round.guesses[context.viewerId] == null
      ? {}
      : { [context.viewerId]: state.round.guesses[context.viewerId] }

  const bets: Record<string, BetSide | null> = revealed
    ? state.round.bets
    : Object.fromEntries(Object.keys(state.round.bets).map((playerId) => [playerId, null]))

  return {
    ...state,
    round: {
      roundNo: state.round.roundNo,
      teamIdx: state.round.teamIdx,
      cluegiver: state.round.cluegiver,
      scale: scaleByKey(state.round.scaleKey) ?? SCALES[0],
      target: seesTarget ? state.round.target : null,
      clue: state.round.clue,
      guesses,
      guessed: Object.keys(state.round.guesses),
      bets,
      marker: revealed ? state.round.marker : null,
      distance: revealed ? state.round.distance : null,
      points: revealed ? state.round.points : null,
      teamPoints: revealed ? state.round.teamPoints : null,
    },
  }
}

export const consensusRadarServerGame: ServerGame<ConsensusGameState, ConsensusGameView> = {
  manifest: consensusRadarManifest,
  createState,
  reduce,
  project,
  leaderboardEntry(state, context) {
    if (state.phase !== 'finished') invalid('Game must be finished before score submission')
    const player = context.players.find((candidate) => candidate.id === context.viewerId)
    if (!player) forbidden('Player has not joined room')
    const topScore = Math.max(...state.teams.map((team) => team.score))
    return {
      playerId: player.id,
      name: player.name,
      score: topScore,
      rounds: state.roundNo,
      metadata: {
        teams: state.teams,
        winnerTeamIdx: state.winnerTeamIdx,
        goal: state.goal,
      },
    }
  },
}

export { CLUE_MAX_LEN }
