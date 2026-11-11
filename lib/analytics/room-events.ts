type RoomAction = Record<string, unknown> & { type?: unknown }

type RoomStartedProperties = {
  game_id: string
  player_count: number
  team_count?: number
  goal?: number
  bets_enabled?: boolean
  host_color?: string
}

export function multiplayerRoomStartedProperties(
  gameId: string,
  playerCount: number,
  action: unknown,
): RoomStartedProperties | null {
  if (!action || typeof action !== 'object') return null
  const candidate = action as RoomAction

  if (candidate.type === 'chess.start') {
    return {
      game_id: gameId,
      player_count: playerCount,
      ...(typeof candidate.hostColor === 'string' ? { host_color: candidate.hostColor } : {}),
      ...(typeof candidate.timeControlId === 'string' ? { time_control: candidate.timeControlId } : {}),
    }
  }

  return null
}
