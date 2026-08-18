import { describe, expect, it } from 'vitest'
import { multiplayerRoomStartedProperties } from './room-events'

describe('multiplayer room analytics', () => {
  it('maps successful start actions to a fixed privacy-safe property schema', () => {
    expect(multiplayerRoomStartedProperties('consensus-radar', 4, {
      type: 'consensus.game.start',
      teamNames: ['Alpha', 'Beta'],
      numTeams: 2,
      categories: ['general', 'analytics'],
      goal: 20,
      betsEnabled: true,
    })).toEqual({
      game_id: 'consensus-radar',
      player_count: 4,
      team_count: 2,
      goal: 20,
      bets_enabled: true,
    })

    expect(multiplayerRoomStartedProperties('chess', 2, {
      type: 'chess.start',
      hostColor: 'random',
    })).toEqual({
      game_id: 'chess',
      player_count: 2,
      host_color: 'random',
    })
  })

  it('ignores non-start actions instead of creating dynamic event shapes', () => {
    expect(multiplayerRoomStartedProperties('consensus-radar', 4, {
      type: 'consensus.clue.submit',
      clue: 'private content',
    })).toBeNull()
  })
})
