export const ANALYTICS_CONSENT_KEY = 'analytics-games.analytics-consent.v1'
export const GAME_SESSION_COUNT_KEY = 'analytics-games.game-session-count.v1'

export type AnalyticsConsent = 'unknown' | 'granted' | 'denied'
export type AnalyticsEventName =
  | 'platform_viewed'
  | 'game_session_started'
  | 'game_session_completed'
  | 'game_session_ended'
  | 'multiplayer_room_created'
  | 'multiplayer_room_joined'
  | 'multiplayer_room_started'

export interface AnalyticsClient {
  init(token: string, options: {
    debug: boolean
    persistence: 'localStorage'
    opt_out_tracking_by_default: true
    track_pageview: false
  }): void
  track(event: string, properties: Record<string, string | number | boolean>): void
  opt_in_tracking(): void
  opt_out_tracking(): void
}

interface AnalyticsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function createAnalyticsController(client: AnalyticsClient, storage: AnalyticsStorage) {
  let initialized = false
  let consent: AnalyticsConsent = 'unknown'

  return {
    initialize(token: string, debug: boolean) {
      if (initialized || !token) return
      client.init(token, {
        debug,
        persistence: 'localStorage',
        opt_out_tracking_by_default: true,
        track_pageview: false,
      })
      initialized = true
      const stored = storage.getItem(ANALYTICS_CONSENT_KEY)
      consent = stored === 'granted' || stored === 'denied' ? stored : 'unknown'
      if (consent === 'granted') client.opt_in_tracking()
      if (consent === 'denied') client.opt_out_tracking()
    },

    setConsent(nextConsent: Exclude<AnalyticsConsent, 'unknown'>) {
      consent = nextConsent
      storage.setItem(ANALYTICS_CONSENT_KEY, nextConsent)
      if (!initialized) return
      if (nextConsent === 'granted') client.opt_in_tracking()
      else client.opt_out_tracking()
    },

    track(event: AnalyticsEventName, properties: Record<string, string | number | boolean>) {
      if (!initialized || consent !== 'granted') return false
      client.track(event, { ...properties, platform: 'web' })
      return true
    },

    trackGameSessionStarted(properties: { game_id: string; game_title: string }) {
      const parsedCount = Number.parseInt(storage.getItem(GAME_SESSION_COUNT_KEY) ?? '0', 10)
      const sessionCount = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 0
      const tracked = this.track('game_session_started', {
        ...properties,
        is_returning_user: sessionCount > 0,
      })
      if (tracked) storage.setItem(GAME_SESSION_COUNT_KEY, String(sessionCount + 1))
      return tracked
    },

    getConsent() {
      return consent
    },
  }
}
