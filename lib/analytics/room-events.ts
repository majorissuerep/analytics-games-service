type RoomAction = Record<string, unknown> & { type?: unknown }

type RoomStartedProperties = {
  game_id: string
  player_count: number
  team_count?: number
  rounds_per_team?: number
  timer_seconds?: number
  host_color?: string
}

function integerProperty(value: unknown) {
  return Number.isInteger(value) ? value as number : undefined
}

export function multiplayerRoomStartedProperties(
  gameId: string,
  playerCount: number,
  action: unknown,
): RoomStartedProperties | null {
  if (!action || typeof action !== 'object') return null
  const candidate = action as RoomAction

  if (candidate.type === 'consensus.game.start') {
    return {
      game_id: gameId,
      player_count: playerCount,
      team_count: integerProperty(candidate.numTeams),
      rounds_per_team: integerProperty(candidate.roundsPerTeam),
      timer_seconds: integerProperty(candidate.timerSecs),
    }
  }

  if (candidate.type === 'chess.start') {
    return {
      game_id: gameId,
      player_count: playerCount,
      ...(typeof candidate.hostColor === 'string' ? { host_color: candidate.hostColor } : {}),
    }
  }

  return null
}
