import type { EnginePlayer } from '@/lib/engine/types'
import type { Scale } from './scales'

export type Lang = 'uk' | 'en'
export type ConsensusPhase = 'lobby' | 'cluegiver' | 'guessing' | 'result' | 'final'

export interface ConsensusRoundState {
  turnIdx: number
  teamIdx: number
  cluegiver: string
  scaleIndex: number
  target: number
  clue: string
  guesses: Record<string, number>
  locked: Record<string, boolean>
  scored: boolean
  timerStart: number | null
}
export interface ConsensusGameState {
  phase: ConsensusPhase
  teams: string[]
  roundsPerTeam: number
  timerSecs: number
  playerTeams: Record<string, number>
  cluegivers: Record<number, string>
  usedScales: number[]
  turnOrder: number[]
  turnPtr: number
  scores: number[]
  round: ConsensusRoundState | null
}

export interface ConsensusRoundView {
  turnIdx: number
  teamIdx: number
  cluegiver: string
  scale: Scale
  target: number | null
  clue: string
  guesses: Record<string, number>
  locked: Record<string, boolean>
  scored: boolean
  timerStart: number | null
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
  | { type: 'consensus.cluegiver.assign'; teamIndex: number }
  | {
      type: 'consensus.lobby.configure'
      teamNames: string[]
      numTeams: number
      roundsPerTeam: number
      timerSecs: number
    }
  | {
      type: 'consensus.game.start'
      teamNames: string[]
      numTeams: number
      roundsPerTeam: number
      timerSecs: number
    }
  | { type: 'consensus.clue.submit'; clue: string }
  | { type: 'consensus.guess.lock'; guess: number }
  | { type: 'consensus.round.reveal' }
  | { type: 'consensus.round.next' }
  | { type: 'consensus.game.reset' }

export interface ScoreResult {
  pts: number
  key: 'supermark' | 'bullseye' | 'close' | 'opposite' | 'far'
}

export function scoreFor(guess: number, target: number): ScoreResult {
  const distance = Math.abs(guess - target)
  if (distance <= 1) return { pts: 10, key: 'supermark' }
  if (distance <= 4) return { pts: 5, key: 'bullseye' }
  if (distance <= 12) return { pts: 3, key: 'close' }

  const opposite = (guess - 50) * (target - 50) < 0
  if (opposite && distance > 28) return { pts: -2, key: 'opposite' }
  return { pts: 0, key: 'far' }
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
