import type { GameManifest } from '@/lib/engine/types'
import { chessManifest } from './chess/manifest'
import { consensusRadarManifest } from './consensus-radar/manifest'
import { minefieldManifest } from './minefield/manifest'
import { orbitPinballManifest } from './orbit-pinball/manifest'
import { paintboxManifest } from './paintbox/manifest'

export const INTERNAL_GAME_CATALOG: readonly GameManifest[] = [
  chessManifest,
  consensusRadarManifest,
  minefieldManifest,
  orbitPinballManifest,
  paintboxManifest,
]

// Kept as a compatibility alias for server rule registration and tests.
export const GAME_CATALOG = INTERNAL_GAME_CATALOG

export function getGameManifest(gameId: string): GameManifest | undefined {
  return INTERNAL_GAME_CATALOG.find((game) => game.id === gameId)
}
