import { describe, expect, it } from 'vitest'
import { issuePlayerCapability, verifyPlayerCapability } from './player-capability'

describe('player room capability', () => {
  it('verifies issued token without storing raw secret', () => {
    const capability = issuePlayerCapability()
    expect(capability.token).not.toBe(capability.hash)
    expect(verifyPlayerCapability(capability.hash, capability.token)).toBe(true)
    expect(verifyPlayerCapability(capability.hash, `${capability.token}x`)).toBe(false)
  })
})
