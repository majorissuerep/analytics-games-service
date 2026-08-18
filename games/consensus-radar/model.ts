import type { EnginePlayer } from '@/lib/engine/types'
import { scaleByKey, type Category, type Lang, type Scale } from './scales'

export type { Category, Lang, Scale }
export { scaleByKey }

/** Team colors by index — the upstream palette, up to six teams. */
export const TEAM_COLORS = ['#5ee0c5', '#ff7a9c', '#7aa2ff', '#ffcf5c', '#5ee08a', '#c08bff']

export const MIN_TEAMS = 2
export const MAX_TEAMS = 6
export const GOAL_OPTIONS = [0, 15, 20, 25, 30] as const // 0 = endless
export const CLUE_MAX_LEN = 120
export const NAME_MAX_LEN = 24
export const BET_POINTS = 1

export type BetSide = 'left' | 'right'
export type ConsensusPhase = 'lobby' | 'clue' | 'guess' | 'reveal' | 'finished'

// ---------------------------------------------------------------------
// Scoring — the bands of the latest upstream game.
// ---------------------------------------------------------------------
export type ScoreKey = 'bullseye' | 'close' | 'far' | 'opposite'

export function scoreFor(target: number, marker: number): { pts: number; key: ScoreKey } {
  const distance = Math.abs(target - marker)
  if (distance <= 5) return { pts: 5, key: 'bullseye' }
  if (distance <= 12) return { pts: 3, key: 'close' }
  if (distance <= 40) return { pts: 0, key: 'far' }
  return { pts: -2, key: 'opposite' }
}

export function betIsCorrect(target: number, marker: number, side: BetSide): boolean {
  if (marker === target) return true // dead centre: nobody loses the bet
  return side === 'left' ? marker < target : marker > target
}

/** The team's marker is the average of everyone who submitted, kept at 0.1. */
export function averageMarker(values: number[]): number {
  if (values.length === 0) return 50
  const sum = values.reduce((total, value) => total + value, 0)
  return Math.round((sum / values.length) * 10) / 10
}

// ---------------------------------------------------------------------
// State
// ---------------------------------------------------------------------
export interface ConsensusTeamState {
  name: string
  score: number
}

export interface ConsensusRoundState {
  roundNo: number
  teamIdx: number
  cluegiver: string
  scaleKey: string
  target: number
  clue: string
  /** playerId -> slider value; projected only at reveal (or to its owner). */
  guesses: Record<string, number>
  /** playerId -> side; projected only at reveal (actees are visible). */
  bets: Record<string, BetSide>
  /** Reveal results — null until the round is revealed. */
  marker: number | null
  distance: number | null
  points: number | null
  /** Per-team score delta applied at reveal, by team index. */
  teamPoints: number[] | null
}

export interface ConsensusGameState {
  phase: ConsensusPhase
  categories: Category[]
  goal: number
  betsEnabled: boolean
  teams: ConsensusTeamState[]
  playerTeams: Record<string, number>
  clueTurns: Record<string, number>
  usedScaleKeys: string[]
  activeTeamIdx: number
  roundNo: number
  round: ConsensusRoundState | null
  winnerTeamIdx: number | null
}

// ---------------------------------------------------------------------
// Views (what project() may expose to a viewer)
// ---------------------------------------------------------------------
export interface ConsensusRoundView {
  roundNo: number
  teamIdx: number
  cluegiver: string
  scale: Scale
  target: number | null
  clue: string
  guesses: Record<string, number>
  /** Ids of players who locked a marker (values stay hidden until reveal). */
  guessed: string[]
  /** playerId -> side once revealed; playerId -> null while hidden. */
  bets: Record<string, BetSide | null>
  marker: number | null
  distance: number | null
  points: number | null
  teamPoints: number[] | null
}

export interface ConsensusGameView extends Omit<ConsensusGameState, 'round'> {
  round: ConsensusRoundView | null
}

export interface ConsensusPlayer extends EnginePlayer {
  team: number
}

export interface ConsensusRoomView extends ConsensusGameView {
  hostId: string
  players: ConsensusPlayer[]
}

export type ConsensusAction =
  | { type: 'consensus.team.assign'; teamIndex: number }
  | {
      type: 'consensus.lobby.configure'
      teamNames?: string[]
      numTeams?: number
      categories?: string[]
      goal?: number
      betsEnabled?: boolean
    }
  | {
      type: 'consensus.game.start'
      teamNames?: string[]
      numTeams?: number
      categories?: string[]
      goal?: number
      betsEnabled?: boolean
    }
  | { type: 'consensus.clue.submit'; clue: string }
  | { type: 'consensus.guess.submit'; value: number }
  | { type: 'consensus.bet.submit'; side: BetSide }
  | { type: 'consensus.round.reveal' }
  | { type: 'consensus.round.next' }
  | { type: 'consensus.game.end' }
  | { type: 'consensus.game.reset' }

// ---------------------------------------------------------------------
// Small pure helpers shared with the client for previews
// ---------------------------------------------------------------------
export function cleanName(raw: unknown, fallback: string): string {
  const text = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : ''
  return (text || fallback).slice(0, NAME_MAX_LEN)
}

export function cleanClue(raw: unknown): string {
  const text = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : ''
  return text.slice(0, CLUE_MAX_LEN)
}

export function clueHasDigits(clue: string): boolean {
  return /\d/.test(clue)
}

export function clampSlider(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  return Math.min(100, Math.max(0, Math.round(raw)))
}

/** Clue-giver rotation: fewest turns so far wins, ties broken by join order. */
export function pickClueGiver(
  teamPlayerIds: string[],
  clueTurns: Record<string, number>,
): string | null {
  if (teamPlayerIds.length === 0) return null
  return [...teamPlayerIds].sort(
    (a, b) => (clueTurns[a] ?? 0) - (clueTurns[b] ?? 0),
  )[0]
}

/** Next team index that actually has players, starting after `from`. */
export function nextStaffedTeamIndex(
  teams: ConsensusTeamState[],
  playerTeams: Record<string, number>,
  from: number,
): number | null {
  for (let step = 1; step <= teams.length; step += 1) {
    const idx = (from + step) % teams.length
    if (Object.values(playerTeams).some((teamIdx) => teamIdx === idx)) return idx
  }
  return null
}

export function firstStaffedTeamIndex(
  teams: ConsensusTeamState[],
  playerTeams: Record<string, number>,
): number | null {
  for (let idx = 0; idx < teams.length; idx += 1) {
    if (Object.values(playerTeams).some((teamIdx) => teamIdx === idx)) return idx
  }
  return null
}

export function leaderTeamIdx(teams: ConsensusTeamState[]): number | null {
  if (teams.length === 0) return null
  let best = 0
  for (let idx = 1; idx < teams.length; idx += 1) {
    if (teams[idx].score > teams[best].score) best = idx
  }
  return best
}

export function toConsensusRoomView(
  game: ConsensusGameView,
  players: EnginePlayer[],
  hostId: string,
): ConsensusRoomView {
  return {
    ...game,
    hostId,
    players: players.map((player) => ({
      ...player,
      team: game.playerTeams[player.id] ?? -1,
    })),
  }
}
