export type GameStatus = 'live' | 'beta' | 'coming-soon'

export const GAME_BRIDGE_VERSION = 1 as const

export interface InternalGameIntegration {
  kind: 'internal'
  launchPath?: string
}

export interface ExternalGameIntegration {
  kind: 'external'
  launchUrl: string
  origin: string
  bridgeVersion: typeof GAME_BRIDGE_VERSION
  openMode?: 'embedded' | 'redirect'
}

export type GameIntegration = InternalGameIntegration | ExternalGameIntegration

export interface GameInstruction {
  title: string
  detail: string
}

export interface GameManifest {
  id: string
  version: number
  title: string
  eyebrow: string
  description: string
  accent: string
  accentSoft: string
  minPlayers: number
  maxPlayers: number
  estimatedMinutes: string
  tags: string[]
  instructions: GameInstruction[]
  preferredWindow?: { width: number; height: number }
  status: GameStatus
  integration: GameIntegration
  icon?: string
}

export interface EnginePlayer {
  id: string
  name: string
}

export interface RoomSnapshot<TGameView = unknown> {
  code: string
  gameId: string
  gameVersion: number
  hostId: string
  revision: number
  players: EnginePlayer[]
  game: TGameView
  createdAt: string
  updatedAt: string
}

export interface LeaderboardRow {
  id: number
  playerId: string
  name: string
  score: number
  rounds: number
  createdAt: string
  updatedAt: string
}

export interface EngineAction {
  type: string
  [key: string]: unknown
}
