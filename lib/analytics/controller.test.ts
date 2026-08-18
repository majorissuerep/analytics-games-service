import { describe, expect, it, vi } from 'vitest'
import {
  ANALYTICS_CONSENT_KEY,
  GAME_SESSION_COUNT_KEY,
  createAnalyticsController,
} from './controller'

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

describe('analytics consent', () => {
  it('initializes opted out and blocks events until consent is granted', () => {
    const client = {
      init: vi.fn(),
      track: vi.fn(),
      opt_in_tracking: vi.fn(),
      opt_out_tracking: vi.fn(),
    }
    const storage = memoryStorage()
    const analytics = createAnalyticsController(client, storage)

    analytics.initialize('project-token', false)
    analytics.track('platform_viewed', { games_available: 5 })

    expect(client.init).toHaveBeenCalledWith('project-token', expect.objectContaining({
      opt_out_tracking_by_default: true,
      persistence: 'localStorage',
    }))
    expect(client.track).not.toHaveBeenCalled()

    analytics.setConsent('granted')
    analytics.track('platform_viewed', { games_available: 5 })

    expect(storage.getItem(ANALYTICS_CONSENT_KEY)).toBe('granted')
    expect(client.opt_in_tracking).toHaveBeenCalledOnce()
    expect(client.track).toHaveBeenCalledWith('platform_viewed', {
      games_available: 5,
      platform: 'web',
    })
  })

  it('marks only launches after the first as returning-user sessions', () => {
    const client = {
      init: vi.fn(),
      track: vi.fn(),
      opt_in_tracking: vi.fn(),
      opt_out_tracking: vi.fn(),
    }
    const storage = memoryStorage({ [ANALYTICS_CONSENT_KEY]: 'granted' })
    const analytics = createAnalyticsController(client, storage)
    analytics.initialize('project-token', false)

    analytics.trackGameSessionStarted({ game_id: 'minefield', game_title: 'Minefield' })
    analytics.trackGameSessionStarted({ game_id: 'chess', game_title: 'Chess' })

    expect(client.track).toHaveBeenNthCalledWith(1, 'game_session_started', {
      game_id: 'minefield',
      game_title: 'Minefield',
      is_returning_user: false,
      platform: 'web',
    })
    expect(client.track).toHaveBeenNthCalledWith(2, 'game_session_started', {
      game_id: 'chess',
      game_title: 'Chess',
      is_returning_user: true,
      platform: 'web',
    })
    expect(storage.getItem(GAME_SESSION_COUNT_KEY)).toBe('2')
  })
})
