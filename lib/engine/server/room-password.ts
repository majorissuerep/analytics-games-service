import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 32

export function createRoomPasswordHash(password: string) {
  const normalized = password.trim().slice(0, 100)
  if (!normalized) return ''
  const salt = randomBytes(16).toString('hex')
  const digest = scryptSync(normalized, salt, KEY_LENGTH).toString('hex')
  return `${salt}:${digest}`
}

export function verifyRoomPassword(stored: string, password: string) {
  if (!stored) return !password.trim()
  const [salt, expectedHex] = stored.split(':')
  if (!salt || !expectedHex) return false
  const expected = Buffer.from(expectedHex, 'hex')
  const actual = scryptSync(password.trim().slice(0, 100), salt, KEY_LENGTH)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
