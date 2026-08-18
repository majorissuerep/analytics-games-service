import { describe, expect, it } from 'vitest'
import {
  INTERNAL_ANALYTICS_PROTOCOL,
  readInternalAnalyticsRelay,
} from './internal-relay'

describe('internal analytics relay', () => {
  it('accepts only fixed room events and host-authoritative properties', () => {
    expect(readInternalAnalyticsRelay({
      protocol: INTERNAL_ANALYTICS_PROTOCOL,
      version: 1,
      type: 'analytics.track',
      event: 'multiplayer_room_started',
      properties: {
        game_id: 'forged-game',
        player_count: 3,
        team_count: 2,
        room_code: 'PRIVATE',
      },
    }, 'consensus-radar')).toEqual({
      event: 'multiplayer_room_started',
      properties: {
        game_id: 'consensus-radar',
        player_count: 3,
        team_count: 2,
      },
    })

    expect(readInternalAnalyticsRelay({
      protocol: INTERNAL_ANALYTICS_PROTOCOL,
      version: 1,
      type: 'analytics.track',
      event: 'dynamic_private_event',
      properties: { value: 'secret' },
    }, 'chess')).toBeNull()
  })
})
