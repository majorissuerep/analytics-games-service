import type { GameManifest } from '@/lib/engine/types'
import { consensusRadarManifest } from './consensus-radar/manifest'

export const INTERNAL_GAME_CATALOG: readonly GameManifest[] = [consensusRadarManifest]

// Kept as a compatibility alias for server rule registration and tests.
export const GAME_CATALOG = INTERNAL_GAME_CATALOG

export function getGameManifest(gameId: string): GameManifest | undefined {
  return INTERNAL_GAME_CATALOG.find((game) => game.id === gameId)
}
