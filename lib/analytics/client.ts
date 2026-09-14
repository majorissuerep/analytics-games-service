'use client'

import {
  createAnalyticsController,
  type AnalyticsClient,
  type AnalyticsConsent,
  type AnalyticsEventName,
} from './controller'
import { relayInternalAnalyticsEvent } from './internal-relay'

const listeners = new Set<() => void>()
const onceKeys = new Set<string>()
let controller: ReturnType<typeof createAnalyticsController> | null = null

const ANALYTICS_RELAY_PATH = '/api/analytics/events'
const ANALYTICS_ANONYMOUS_ID_KEY = 'analytics-games.analytics-anonymous-id.v1'
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

const client: AnalyticsClient = {
  init() {},
  track(event, properties) {
    const anonymousId = getOrCreateAnonymousId()
    if (!anonymousId) return

    void fetch(ANALYTICS_RELAY_PATH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      keepalive: true,
      body: JSON.stringify({
        event,
        messageId: `web_${crypto.randomUUID()}`,
        anonymousId,
        properties,
      }),
    }).catch(() => {
      // Analytics must never break gameplay or surface payloads in the console.
    })
  },
  opt_in_tracking() {},
  opt_out_tracking() {},
}

function getOrCreateAnonymousId() {
  try {
    const existing = window.localStorage.getItem(ANALYTICS_ANONYMOUS_ID_KEY)
    if (existing && OPAQUE_ID_PATTERN.test(existing)) return existing

    const next = `anon_${crypto.randomUUID()}`
    window.localStorage.setItem(ANALYTICS_ANONYMOUS_ID_KEY, next)
    return next
  } catch {
    return null
  }
}

function notify() {
  listeners.forEach((listener) => listener())
}

export function initializeAnalytics(enabled: boolean) {
  controller ??= createAnalyticsController(client, window.localStorage)
  controller.initialize(enabled, process.env.NODE_ENV !== 'production')
  notify()
}

export function setAnalyticsConsent(consent: Exclude<AnalyticsConsent, 'unknown'>) {
  controller?.setConsent(consent)
  notify()
}

export function getAnalyticsConsent(): AnalyticsConsent {
  return controller?.getConsent() ?? 'unknown'
}

export function subscribeToAnalytics(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function trackAnalyticsEvent(
  event: AnalyticsEventName,
  properties: Record<string, string | number | boolean>,
) {
  if (controller) return controller.track(event, properties)
  return relayInternalAnalyticsEvent(event, properties)
}

export function trackAnalyticsEventOnce(
  key: string,
  event: AnalyticsEventName,
  properties: Record<string, string | number | boolean>,
) {
  if (onceKeys.has(key)) return false
  const tracked = trackAnalyticsEvent(event, properties)
  if (tracked) onceKeys.add(key)
  return tracked
}

export function trackGameSessionStarted(
  properties: { game_id: string; game_title: string } & Record<string, string | number | boolean>,
) {
  return controller?.trackGameSessionStarted(properties) ?? false
}
