import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { EngineError } from '@/lib/engine/errors'
import type { StoredRoom } from './contracts'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
export function issuePlayerCapability() {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token) }
}

export function verifyPlayerCapability(expectedHash: string | undefined, token: string) {
  if (!expectedHash || !token) return false
  const actual = Buffer.from(hashToken(token), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function assertPlayerCapability(
  room: StoredRoom<unknown>,
  playerId: string,
  token: string,
) {
  const player = room.state.players.find((candidate) => candidate.id === playerId)
  if (!player || !verifyPlayerCapability(room.state.playerTokens[playerId], token)) {
    throw new EngineError('FORBIDDEN', 'Invalid player capability for this room', 403)
  }
}

export function readBearerToken(headers: Headers) {
  const authorization = headers.get('authorization') ?? ''
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
}
