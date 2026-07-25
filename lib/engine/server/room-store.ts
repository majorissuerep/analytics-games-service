import { randomInt } from 'node:crypto'
import type { PoolClient } from 'pg'
import { ensurePlatformSchema } from '@/lib/db/ensure-schema'
import { pool } from '@/lib/db/index'
import { EngineError } from '@/lib/engine/errors'
import type { EnginePlayer, RoomSnapshot } from '@/lib/engine/types'
import type { StoredRoom, StoredRoomState } from './contracts'
import { projectRoom } from './contracts'
import {
  assertPlayerCapability,
  issuePlayerCapability,
  verifyPlayerCapability,
} from './player-capability'
import { getServerGame } from './registry'
import { createRoomPasswordHash, verifyRoomPassword } from './room-password'

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_CODE_LENGTH = 6
const CREATE_ATTEMPTS = 8

export interface RoomMembership {
  room: RoomSnapshot<unknown>
  playerToken: string
}

interface RoomRow {
  code: string
  game_id: string
  host_id: string
  state: string
  revision: number
  created_at: Date | string
  updated_at: Date | string
}

const random = {
  int(minInclusive: number, maxInclusive: number) {
    return randomInt(minInclusive, maxInclusive + 1)
  },
}

function createRoomCode() {
  return Array.from(
    { length: ROOM_CODE_LENGTH },
    () => ROOM_ALPHABET[random.int(0, ROOM_ALPHABET.length - 1)],
  ).join('')
}

function normalizePlayer(input: EnginePlayer): EnginePlayer {
  const id = typeof input?.id === 'string' ? input.id.trim().slice(0, 100) : ''
  const name = typeof input?.name === 'string' ? input.name.trim().slice(0, 40) : ''
  if (!id) throw new EngineError('BAD_REQUEST', 'Player id is required')
  if (!name) throw new EngineError('BAD_REQUEST', 'Player name is required')
  return { id, name }
}

function parseRoom(row: RoomRow): StoredRoom<unknown> {
  let state: StoredRoomState<unknown>
  try {
    state = JSON.parse(row.state) as StoredRoomState<unknown>
  } catch {
    throw new EngineError('INVALID_ACTION', `Room ${row.code} has invalid stored state`, 500)
  }
  if (!Array.isArray(state.players) || !('game' in state)) {
    throw new EngineError('INVALID_ACTION', `Room ${row.code} has unsupported stored state`, 500)
  }
  state.playerTokens = state.playerTokens && typeof state.playerTokens === 'object'
    ? state.playerTokens
    : {}
  state.gameVersion = Number.isInteger(state.gameVersion) ? state.gameVersion : 1
  return {
    code: row.code,
    gameId: row.game_id,
    hostId: row.host_id,
    revision: row.revision,
    state,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

async function selectRoom(client: PoolClient, code: string, lock = false) {
  const result = await client.query<RoomRow>(
    `
      SELECT code, game_id, host_id, state, revision, created_at, updated_at
      FROM game_rooms
      WHERE code = $1
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [code.toUpperCase()],
  )
  if (!result.rows[0]) throw new EngineError('ROOM_NOT_FOUND', 'Room not found', 404)
  return parseRoom(result.rows[0])
}

export async function createRoom(
  gameId: string,
  hostInput: EnginePlayer,
  password = '',
): Promise<RoomMembership> {
  await ensurePlatformSchema()
  const game = getServerGame(gameId)
  const host = normalizePlayer(hostInput)

  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt += 1) {
    const code = createRoomCode()
    const now = new Date()
    const capability = issuePlayerCapability()
    const state: StoredRoomState<unknown> = {
      players: [host],
      playerTokens: { [host.id]: capability.hash },
      passwordHash: createRoomPasswordHash(password),
      gameVersion: game.manifest.version,
      game: game.createState({ host, now, random }),
    }
    const result = await pool.query<RoomRow>(
      `
        INSERT INTO game_rooms (code, game_id, host_id, state, revision, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 0, $5, $5)
        ON CONFLICT (code) DO NOTHING
        RETURNING code, game_id, host_id, state, revision, created_at, updated_at
      `,
      [code, gameId, host.id, JSON.stringify(state), now],
    )
    if (result.rows[0]) {
      return {
        room: projectRoom(parseRoom(result.rows[0]), game, host.id),
        playerToken: capability.token,
      }
    }
  }

  throw new EngineError('ROOM_CODE_EXHAUSTED', 'Could not allocate room code', 503)
}

export async function getStoredRoom(code: string): Promise<StoredRoom<unknown>> {
  await ensurePlatformSchema()
  const client = await pool.connect()
  try {
    return await selectRoom(client, code)
  } finally {
    client.release()
  }
}

export async function getRoom(
  code: string,
  viewerId: string,
  playerToken: string,
): Promise<RoomSnapshot<unknown>> {
  if (!viewerId) throw new EngineError('BAD_REQUEST', 'viewerId is required')
  const room = await getStoredRoom(code)
  const game = getServerGame(room.gameId)
  assertSupportedGameVersion(room, game.manifest.version)
  assertPlayerCapability(room, viewerId, playerToken)
  return projectRoom(room, game, viewerId)
}

export function assertSupportedGameVersion(room: StoredRoom<unknown>, currentVersion: number) {
  if (room.state.gameVersion !== currentVersion) {
    throw new EngineError(
      'INVALID_ACTION',
      `Room uses ${room.gameId} state v${room.state.gameVersion}; server expects v${currentVersion}`,
      409,
    )
  }
}

async function persistRoom(client: PoolClient, room: StoredRoom<unknown>) {
  const result = await client.query<RoomRow>(
    `
      UPDATE game_rooms
      SET state = $2, revision = revision + 1, updated_at = NOW()
      WHERE code = $1
      RETURNING code, game_id, host_id, state, revision, created_at, updated_at
    `,
    [room.code, JSON.stringify(room.state)],
  )
  return parseRoom(result.rows[0])
}

export async function joinRoom(
  code: string,
  playerInput: EnginePlayer,
  currentToken: string,
  password = '',
): Promise<RoomMembership> {
  const player = normalizePlayer(playerInput)
  await ensurePlatformSchema()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const room = await selectRoom(client, code, true)
    const game = getServerGame(room.gameId)
    assertSupportedGameVersion(room, game.manifest.version)
    if (!verifyRoomPassword(room.state.passwordHash ?? '', password)) {
      throw new EngineError('FORBIDDEN', 'Incorrect room password', 403)
    }
    const existing = room.state.players.find((candidate) => candidate.id === player.id)
    let playerToken = currentToken

    if (existing) {
      if (!verifyPlayerCapability(room.state.playerTokens[player.id], currentToken)) {
        throw new EngineError(
          'FORBIDDEN',
          'Player already joined this room; original room capability is required',
          403,
        )
      }
      room.state.players = room.state.players.map((candidate) =>
        candidate.id === player.id ? player : candidate,
      )
    } else {
      if (room.state.players.length >= game.manifest.maxPlayers) {
        throw new EngineError('INVALID_ACTION', `Room is full (${game.manifest.maxPlayers} players)`, 409)
      }
      const capability = issuePlayerCapability()
      playerToken = capability.token
      room.state.playerTokens[player.id] = capability.hash
      room.state.players = [...room.state.players, player]
    }

    const storedRoom = await persistRoom(client, room)
    await client.query('COMMIT')
    return {
      room: projectRoom(storedRoom, game, player.id),
      playerToken,
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export async function applyRoomAction(
  code: string,
  actorId: string,
  playerToken: string,
  action: unknown,
): Promise<RoomSnapshot<unknown>> {
  if (!actorId) throw new EngineError('BAD_REQUEST', 'actorId is required')
  if (!action || typeof action !== 'object' || !('type' in action) || typeof action.type !== 'string') {
    throw new EngineError('BAD_REQUEST', 'Action must include a type')
  }

  await ensurePlatformSchema()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const room = await selectRoom(client, code, true)
    const game = getServerGame(room.gameId)
    assertSupportedGameVersion(room, game.manifest.version)
    assertPlayerCapability(room, actorId, playerToken)
    room.state.game = game.reduce(room.state.game, action, {
      actorId,
      hostId: room.hostId,
      players: room.state.players,
      now: new Date(),
      random,
    })

    const storedRoom = await persistRoom(client, room)
    await client.query('COMMIT')
    return projectRoom(storedRoom, game, actorId)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}
