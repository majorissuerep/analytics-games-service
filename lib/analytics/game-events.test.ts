import { describe, expect, it } from 'vitest'
import {
  ANALYTICS_GAME_BRIDGE,
  ANALYTICS_GAME_BRIDGE_VERSION,
} from '@analytics-games/game-bridge'
import { gameCompletionFromMessage, gameExitReasonFromMessage } from './game-events'

describe('game completion telemetry', () => {
  it('accepts only the fixed completion event and a bounded string result', () => {
    expect(gameCompletionFromMessage({
      protocol: ANALYTICS_GAME_BRIDGE,
      version: ANALYTICS_GAME_BRIDGE_VERSION,
      type: 'game.telemetry',
      payload: { name: 'game_session_completed', value: 'won' },
    })).toBe('won')

    expect(gameCompletionFromMessage({
      protocol: ANALYTICS_GAME_BRIDGE,
      version: ANALYTICS_GAME_BRIDGE_VERSION,
      type: 'game.telemetry',
      payload: { name: 'dynamic_private_event', value: 'secret' },
    })).toBeNull()

    expect(gameCompletionFromMessage({
      protocol: ANALYTICS_GAME_BRIDGE,
      version: ANALYTICS_GAME_BRIDGE_VERSION,
      type: 'game.telemetry',
      payload: { name: 'game_session_completed', value: 'private free-form text' },
    })).toBeNull()

    expect(gameCompletionFromMessage({
      protocol: ANALYTICS_GAME_BRIDGE,
      version: ANALYTICS_GAME_BRIDGE_VERSION,
      type: 'game.telemetry',
    })).toBeNull()
  })

  it('maps malformed exit reasons to a fixed error value', () => {
    expect(gameExitReasonFromMessage({
      protocol: ANALYTICS_GAME_BRIDGE,
      version: ANALYTICS_GAME_BRIDGE_VERSION,
      type: 'game.exit',
      payload: { reason: { private: 'value' } },
    })).toBe('error')
  })
})
