export const ANALYTICS_GAME_BRIDGE = 'analytics-games.bridge' as const
export const ANALYTICS_GAME_BRIDGE_VERSION = 1 as const

export interface HostInitMessage {
  protocol: typeof ANALYTICS_GAME_BRIDGE
  version: typeof ANALYTICS_GAME_BRIDGE_VERSION
  type: 'host.init'
  payload: {
    gameId: string
    sessionId: string
    locale: string
    theme: 'millennium'
    returnUrl: string
    capabilities: readonly ['exit', 'focus', 'telemetry']
  }
}

export interface GameReadyMessage {
  protocol: typeof ANALYTICS_GAME_BRIDGE
  version: typeof ANALYTICS_GAME_BRIDGE_VERSION
  type: 'game.ready'
}

export interface GameExitMessage {
  protocol: typeof ANALYTICS_GAME_BRIDGE
  version: typeof ANALYTICS_GAME_BRIDGE_VERSION
  type: 'game.exit'
  payload?: { reason?: 'complete' | 'cancel' | 'error' }
}

export interface GameTelemetryMessage {
  protocol: typeof ANALYTICS_GAME_BRIDGE
  version: typeof ANALYTICS_GAME_BRIDGE_VERSION
  type: 'game.telemetry'
  payload: { name: string; value?: string | number | boolean }
}

export type GameToHostMessage = GameReadyMessage | GameExitMessage | GameTelemetryMessage
export type HostToGameMessage = HostInitMessage

export function isGameToHostMessage(value: unknown): value is GameToHostMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  return (
    message.protocol === ANALYTICS_GAME_BRIDGE &&
    message.version === ANALYTICS_GAME_BRIDGE_VERSION &&
    (message.type === 'game.ready' ||
      message.type === 'game.exit' ||
      message.type === 'game.telemetry')
  )
}

export function readyMessage(): GameReadyMessage {
  return {
    protocol: ANALYTICS_GAME_BRIDGE,
    version: ANALYTICS_GAME_BRIDGE_VERSION,
    type: 'game.ready',
  }
}

export function exitMessage(reason: NonNullable<GameExitMessage['payload']>['reason'] = 'cancel'): GameExitMessage {
  return {
    protocol: ANALYTICS_GAME_BRIDGE,
    version: ANALYTICS_GAME_BRIDGE_VERSION,
    type: 'game.exit',
    payload: { reason },
  }
}
