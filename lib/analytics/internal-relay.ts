'use client'

import type { AnalyticsEventName } from './controller'

export const INTERNAL_ANALYTICS_PROTOCOL = 'analytics-games/internal-analytics'
const INTERNAL_ANALYTICS_VERSION = 1

type RoomAnalyticsEventName = Extract<
  AnalyticsEventName,
  'multiplayer_room_created' | 'multiplayer_room_joined' | 'multiplayer_room_started'
>

const ROOM_EVENTS = new Set<RoomAnalyticsEventName>([
  'multiplayer_room_created',
  'multiplayer_room_joined',
  'multiplayer_room_started',
])

const NUMBER_LIMITS: Record<string, [number, number]> = {
  player_count: [0, 1_000],
  team_count: [1, 100],
  rounds_per_team: [1, 100],
  timer_seconds: [0, 86_400],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function sanitizedProperties(
  event: RoomAnalyticsEventName,
  properties: Record<string, unknown>,
  gameId: string,
) {
  const result: Record<string, string | number | boolean> = { game_id: gameId }
  for (const [key, [minimum, maximum]] of Object.entries(NUMBER_LIMITS)) {
    const value = properties[key]
    if (Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum) {
      result[key] = Number(value)
    }
  }

  if (event === 'multiplayer_room_created' && typeof properties.is_password_protected === 'boolean') {
    result.is_password_protected = properties.is_password_protected
  }
  if (
    event === 'multiplayer_room_started'
    && typeof properties.host_color === 'string'
    && ['white', 'black', 'random'].includes(properties.host_color)
  ) {
    result.host_color = properties.host_color
  }
  return result
}

export function readInternalAnalyticsRelay(value: unknown, gameId: string) {
  if (!isRecord(value)) return null
  if (
    value.protocol !== INTERNAL_ANALYTICS_PROTOCOL
    || value.version !== INTERNAL_ANALYTICS_VERSION
    || value.type !== 'analytics.track'
    || typeof value.event !== 'string'
    || !ROOM_EVENTS.has(value.event as RoomAnalyticsEventName)
    || !isRecord(value.properties)
  ) return null

  const event = value.event as RoomAnalyticsEventName
  return {
    event,
    properties: sanitizedProperties(event, value.properties, gameId),
  }
}

export function relayInternalAnalyticsEvent(
  event: AnalyticsEventName,
  properties: Record<string, string | number | boolean>,
) {
  if (typeof window === 'undefined' || window.parent === window) return false
  if (!ROOM_EVENTS.has(event as RoomAnalyticsEventName)) return false
  window.parent.postMessage({
    protocol: INTERNAL_ANALYTICS_PROTOCOL,
    version: INTERNAL_ANALYTICS_VERSION,
    type: 'analytics.track',
    event,
    properties,
  }, window.location.origin)
  return true
}
