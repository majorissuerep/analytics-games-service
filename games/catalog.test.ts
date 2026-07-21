import { describe, expect, it } from 'vitest'
import { GAME_CATALOG, getGameManifest } from './catalog'

describe('game catalog', () => {
  it('uses unique, route-safe game ids', () => {
    const ids = GAME_CATALOG.map((game) => game.id)
    expect(new Set(ids).size).toBe(ids.length)
    // Anchored, bounded by manifest validation, and linear despite conservative scanner warning.
    // eslint-disable-next-line security/detect-unsafe-regex
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })

  it('contains complete discovery metadata', () => {
    for (const game of GAME_CATALOG) {
      expect(game.title).toBeTruthy()
      expect(game.description.length).toBeGreaterThan(20)
      expect(game.instructions).toHaveLength(3)
      expect(game.minPlayers).toBeLessThanOrEqual(game.maxPlayers)
      expect(getGameManifest(game.id)).toBe(game)
    }
  })
})
