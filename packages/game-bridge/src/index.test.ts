import { describe, expect, it } from 'vitest'
import {
  ANALYTICS_GAME_BRIDGE,
  ANALYTICS_GAME_BRIDGE_VERSION,
  exitMessage,
  isGameToHostMessage,
  readyMessage,
} from './index'

describe('external game bridge contract', () => {
  it('accepts versioned ready and exit messages', () => {
    expect(isGameToHostMessage(readyMessage())).toBe(true)
    expect(isGameToHostMessage(exitMessage('complete'))).toBe(true)
  })

  it('rejects unknown versions and message types', () => {
    expect(isGameToHostMessage({
      protocol: ANALYTICS_GAME_BRIDGE,
      version: ANALYTICS_GAME_BRIDGE_VERSION + 1,
      type: 'game.ready',
    })).toBe(false)
    expect(isGameToHostMessage({
      protocol: ANALYTICS_GAME_BRIDGE,
      version: ANALYTICS_GAME_BRIDGE_VERSION,
      type: 'host.init',
    })).toBe(false)
  })
})
