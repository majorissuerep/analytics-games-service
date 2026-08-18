'use client'

import mixpanel from 'mixpanel-browser'
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

const client: AnalyticsClient = {
  init(token, options) {
    mixpanel.init(token, {
      ...options,
      batch_requests: false,
      ignore_dnt: false,
    })
  },
  track(event, properties) {
    mixpanel.track(event, properties)
  },
  opt_in_tracking() {
    mixpanel.opt_in_tracking()
  },
  opt_out_tracking() {
    mixpanel.opt_out_tracking()
  },
}

function notify() {
  listeners.forEach((listener) => listener())
}

export function initializeAnalytics(token: string) {
  controller ??= createAnalyticsController(client, window.localStorage)
  controller.initialize(token, process.env.NODE_ENV !== 'production')
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
