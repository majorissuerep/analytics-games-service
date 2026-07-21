import 'server-only'

import type { GameManifest } from '@/lib/engine/types'
import { INTERNAL_GAME_CATALOG } from '@/games/catalog'
import { listExternalGames } from './external-game-store'

export async function listPlatformGames(): Promise<GameManifest[]> {
  try {
    const externalGames = await listExternalGames()
    const internalIds = new Set(INTERNAL_GAME_CATALOG.map((game) => game.id))
    return [
      ...INTERNAL_GAME_CATALOG,
      ...externalGames.filter((game) => !internalIds.has(game.id)),
    ]
  } catch (error) {
    console.error('External game catalog unavailable; serving internal catalog only', error)
    return [...INTERNAL_GAME_CATALOG]
  }
}

export async function getPlatformGame(gameId: string): Promise<GameManifest | undefined> {
  return (await listPlatformGames()).find((game) => game.id === gameId)
}
