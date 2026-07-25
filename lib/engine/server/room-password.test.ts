import { describe, expect, it } from 'vitest'
import { createRoomPasswordHash, verifyRoomPassword } from './room-password'

describe('room passwords', () => {
  it('stores a salted hash and validates the exact password', () => {
    const hash = createRoomPasswordHash('knights-only')
    expect(hash).not.toContain('knights-only')
    expect(verifyRoomPassword(hash, 'knights-only')).toBe(true)
    expect(verifyRoomPassword(hash, 'wrong')).toBe(false)
  })

  it('treats an empty room password as unprotected', () => {
    expect(createRoomPasswordHash('')).toBe('')
    expect(verifyRoomPassword('', '')).toBe(true)
  })
})
