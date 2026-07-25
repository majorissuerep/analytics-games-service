import type { EnginePlayer, GameManifest, RoomSnapshot } from '@/lib/engine/types'

export interface StoredRoomState<TGameState = unknown> {
  players: EnginePlayer[]
  playerTokens: Record<string, string>
  passwordHash?: string
  gameVersion: number
  game: TGameState
}

export interface StoredRoom<TGameState = unknown> {
  code: string
  gameId: string
  hostId: string
  revision: number
  state: StoredRoomState<TGameState>
  createdAt: Date
  updatedAt: Date
}

export interface RandomSource {
  int(minInclusive: number, maxInclusive: number): number
}

export interface CreateGameContext {
  host: EnginePlayer
  now: Date
  random: RandomSource
}

export interface GameActionContext {
  actorId: string
  hostId: string
  players: EnginePlayer[]
  now: Date
  random: RandomSource
}

export interface ProjectGameContext {
  viewerId: string
  hostId: string
  players: EnginePlayer[]
}

export interface LeaderboardEntry {
  playerId: string
  name: string
  score: number
  rounds: number
  metadata?: Record<string, unknown>
}

export interface ServerGame<TState = unknown, TView = unknown> {
  manifest: GameManifest
  createState(context: CreateGameContext): TState
  reduce(state: TState, action: unknown, context: GameActionContext): TState
  project(state: TState, context: ProjectGameContext): TView
  leaderboardEntry(
    state: TState,
    context: ProjectGameContext,
  ): LeaderboardEntry
}

export function projectRoom<TState, TView>(
  room: StoredRoom<TState>,
  game: ServerGame<TState, TView>,
  viewerId: string,
): RoomSnapshot<TView> {
  const context = {
    viewerId,
    hostId: room.hostId,
    players: room.state.players,
  }

  return {
    code: room.code,
    gameId: room.gameId,
    gameVersion: room.state.gameVersion,
    hostId: room.hostId,
    revision: room.revision,
    players: room.state.players,
    game: game.project(room.state.game, context),
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  }
}
