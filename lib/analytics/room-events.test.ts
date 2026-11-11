import { describe, expect, it } from 'vitest'
import { multiplayerRoomStartedProperties } from './room-events'

describe('multiplayer room analytics', () => {
  it('maps successful start actions to a fixed privacy-safe property schema', () => {
    expect(multiplayerRoomStartedProperties('chess', 2, {
      type: 'chess.start',
      hostColor: 'random',
      timeControlId: 'blitz-5',
    })).toEqual({
      game_id: 'chess',
      player_count: 2,
      host_color: 'random',
      time_control: 'blitz-5',
    })
  })

  it('ignores non-start actions instead of creating dynamic event shapes', () => {
    expect(multiplayerRoomStartedProperties('chess', 2, {
      type: 'chess.move',
      privateContent: 'private content',
    })).toBeNull()
  })
})
