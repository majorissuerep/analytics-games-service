/** Tombstones prevent retired modules being restored through external registration. */
export const RETIRED_GAME_IDS: readonly string[] = ['consensus-radar']
export function isRetiredGame(gameId: string) { return RETIRED_GAME_IDS.includes(gameId) }
