import { ensurePlatformSchema } from '@/lib/db/ensure-schema'
import { pool } from '@/lib/db/index'
import { EngineError } from '@/lib/engine/errors'
import type { LeaderboardRow } from '@/lib/engine/types'
import { assertPlayerCapability } from './player-capability'
import { getServerGame } from './registry'
import { assertSupportedGameVersion, getStoredRoom } from './room-store'

interface LeaderboardDbRow {
  id: string | number
  player_id: string
  name: string
  score: number
  rounds: number
  created_at: Date | string
  updated_at: Date | string
}

function mapRow(row: LeaderboardDbRow): LeaderboardRow {
  return {
    id: Number(row.id),
    playerId: row.player_id,
    name: row.name,
    score: row.score,
    rounds: row.rounds,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

export async function listLeaderboard(gameId: string): Promise<LeaderboardRow[]> {
  await ensurePlatformSchema()
  getServerGame(gameId)
  const result = await pool.query<LeaderboardDbRow>(
    `
      SELECT id, player_id, name, score, rounds, created_at, updated_at
      FROM game_leaderboard
      WHERE game_id = $1
      ORDER BY score DESC, updated_at ASC
      LIMIT 25
    `,
    [gameId],
  )
  return result.rows.map(mapRow)
}

export async function submitLeaderboardScore(
  gameId: string,
  roomCode: string,
  playerId: string,
  playerToken: string,
): Promise<LeaderboardRow> {
  await ensurePlatformSchema()
  const room = await getStoredRoom(roomCode)
  if (room.gameId !== gameId) throw new EngineError('BAD_REQUEST', 'Room belongs to another game')
  const game = getServerGame(gameId)
  assertSupportedGameVersion(room, game.manifest.version)
  assertPlayerCapability(room, playerId, playerToken)
  const entry = game.leaderboardEntry(room.state.game, {
    viewerId: playerId,
    hostId: room.hostId,
    players: room.state.players,
  })

  const result = await pool.query<LeaderboardDbRow>(
    `
      INSERT INTO game_leaderboard (
        game_id, room_code, player_id, name, score, rounds, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (game_id, room_code, player_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        score = GREATEST(game_leaderboard.score, EXCLUDED.score),
        rounds = EXCLUDED.rounds,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING id, player_id, name, score, rounds, created_at, updated_at
    `,
    [
      gameId,
      room.code,
      entry.playerId,
      entry.name,
      entry.score,
      entry.rounds,
      JSON.stringify(entry.metadata ?? {}),
    ],
  )
  return mapRow(result.rows[0])
}
