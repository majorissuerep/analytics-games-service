'use client'

import {
  ANALYTICS_GAME_BRIDGE,
  ANALYTICS_GAME_BRIDGE_VERSION,
  isGameToHostMessage,
  type GameTelemetryMessage,
} from '@analytics-games/game-bridge'

export const GAME_COMPLETION_EVENT = 'analytics-games:game-session-completed'
const MIXPANEL_COMPLETION_EVENT = 'game_session_completed'
const COMPLETION_RESULTS = new Set([
  'completed',
  'drawing_saved',
  'won',
  'lost',
  'checkmate',
  'stalemate',
  'repetition',
  'insufficient_material',
  'resigned',
  'draw',
  'model_match_completed',
])

function normalizeResult(value: unknown) {
  return typeof value === 'string' && COMPLETION_RESULTS.has(value) ? value : null
}

export function gameCompletionFromMessage(value: unknown): string | null {
  if (!isGameToHostMessage(value) || value.type !== 'game.telemetry') return null
  if (!value.payload || typeof value.payload !== 'object') return null
  if (value.payload.name !== MIXPANEL_COMPLETION_EVENT) return null
  return normalizeResult(value.payload.value)
}

export function gameExitReasonFromMessage(value: unknown): 'complete' | 'cancel' | 'error' | null {
  if (!isGameToHostMessage(value) || value.type !== 'game.exit') return null
  const reason = value.payload?.reason
  return reason === 'complete' || reason === 'cancel' || reason === 'error' ? reason : 'error'
}

export function emitGameSessionCompleted(result: string) {
  if (typeof window === 'undefined') return
  const normalizedResult = normalizeResult(result)
  if (!normalizedResult) return
  const message: GameTelemetryMessage = {
    protocol: ANALYTICS_GAME_BRIDGE,
    version: ANALYTICS_GAME_BRIDGE_VERSION,
    type: 'game.telemetry',
    payload: { name: MIXPANEL_COMPLETION_EVENT, value: normalizedResult },
  }

  if (window.parent !== window) {
    window.parent.postMessage(message, window.location.origin)
    return
  }

  window.dispatchEvent(new CustomEvent(GAME_COMPLETION_EVENT, {
    detail: { result: normalizedResult },
  }))
}
