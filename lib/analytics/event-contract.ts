import { INTERNAL_GAME_CATALOG } from '@/games/catalog'
import type { AnalyticsEventName } from './controller'

export type AnalyticsPropertyValue = string | number | boolean

export const ANALYTICS_EVENT_NAMES = [
  'platform_viewed',
  'game_session_started',
  'game_session_completed',
  'game_session_ended',
  'multiplayer_room_created',
  'multiplayer_room_joined',
  'multiplayer_room_started',
] as const satisfies readonly AnalyticsEventName[]

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
  'timeout',
  'draw',
  'model_match_completed',
])

const EXIT_REASONS = new Set([
  'window_closed',
  'complete',
  'cancel',
  'error',
  'redirected',
  'unknown',
])

type TrackedGameMetadata = {
  title: string
  version: number
  integrationKind: 'internal'
}

const TRACKED_GAME_METADATA = new Map<string, TrackedGameMetadata>(
  INTERNAL_GAME_CATALOG
    .filter((game) => game.integration.kind === 'internal')
    .map((game): [string, TrackedGameMetadata] => [game.id, {
      title: game.title,
      version: game.version,
      integrationKind: 'internal',
    }]),
)

const CHESS_TIME_CONTROL_IDS = new Set([
  'bullet-1',
  'bullet-2',
  'blitz-3',
  'blitz-5',
  'rapid-10',
  'rapid-15-10',
  'long-30',
  'long-60-30',
])

const PROPERTY_KEYS: Record<AnalyticsEventName, readonly string[]> = {
  platform_viewed: ['platform', 'games_available', 'path'],
  game_session_started: [
    'platform',
    'game_id',
    'game_title',
    'game_version',
    'integration_kind',
    'launch_context',
    'is_returning_user',
  ],
  game_session_completed: ['platform', 'game_id', 'result', 'duration_seconds'],
  game_session_ended: ['platform', 'game_id', 'duration_seconds', 'completed', 'exit_reason'],
  multiplayer_room_created: ['platform', 'game_id', 'player_count', 'is_password_protected'],
  multiplayer_room_joined: ['platform', 'game_id', 'player_count'],
  multiplayer_room_started: [
    'platform',
    'game_id',
    'player_count',
    'team_count',
    'goal',
    'bets_enabled',
    'host_color',
    'time_control',
  ],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function safeString(value: unknown, maximumLength = 100) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > maximumLength
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) return null
  return value
}

function safeInteger(value: unknown, minimum: number, maximum: number) {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= minimum
    && value <= maximum
    ? value
    : null
}

function safeBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

function optionalInteger(record: Record<string, unknown>, key: string, minimum: number, maximum: number) {
  if (!Object.hasOwn(record, key) || record[key] === undefined) return undefined
  return safeInteger(record[key], minimum, maximum)
}

function optionalBoolean(record: Record<string, unknown>, key: string) {
  if (!Object.hasOwn(record, key) || record[key] === undefined) return undefined
  return safeBoolean(record[key])
}

function hasOnlyAllowedKeys(record: Record<string, unknown>, event: AnalyticsEventName) {
  const allowed = new Set(PROPERTY_KEYS[event])
  return Object.keys(record).every((key) => allowed.has(key))
}

function safePath(value: unknown) {
  return value === '/' ? '/' : null
}

function safeTrackedGameId(value: unknown) {
  const gameId = safeString(value, 80)
  return gameId !== null && TRACKED_GAME_METADATA.has(gameId) ? gameId : null
}

function canonicalVersion(value: unknown, expected: number) {
  return value === expected || value === String(expected) ? expected : null
}

function safeTimeControl(value: unknown) {
  return typeof value === 'string' && CHESS_TIME_CONTROL_IDS.has(value) ? value : null
}

function safeResult(value: unknown) {
  return typeof value === 'string' && COMPLETION_RESULTS.has(value) ? value : null
}

function safeExitReason(value: unknown) {
  return typeof value === 'string' && EXIT_REASONS.has(value) ? value : null
}

function safeHostColor(value: unknown) {
  return value === 'white' || value === 'black' || value === 'random' ? value : null
}

export function isAnalyticsEventName(value: unknown): value is AnalyticsEventName {
  return typeof value === 'string' && ANALYTICS_EVENT_NAMES.includes(value as AnalyticsEventName)
}

export function sanitizeAnalyticsProperties(
  event: AnalyticsEventName,
  value: unknown,
): Record<string, AnalyticsPropertyValue> | null {
  if (!isRecord(value) || value.platform !== 'web' || !hasOnlyAllowedKeys(value, event)) return null

  const result: Record<string, AnalyticsPropertyValue> = { platform: 'web' }

  if (event === 'platform_viewed') {
    const gamesAvailable = safeInteger(value.games_available, 0, 1_000)
    const path = safePath(value.path)
    if (gamesAvailable === null || path === null) return null
    return { ...result, games_available: gamesAvailable, path }
  }

  const gameId = safeTrackedGameId(value.game_id)
  if (gameId === null) return null
  result.game_id = gameId

  if (event === 'game_session_started') {
    const metadata = TRACKED_GAME_METADATA.get(gameId)
    const gameTitle = safeString(value.game_title, 100)
    const gameVersion = metadata ? canonicalVersion(value.game_version, metadata.version) : null
    const integrationKind = metadata?.integrationKind ?? null
    const launchContext = value.launch_context === 'desktop' || value.launch_context === 'standalone'
      ? value.launch_context
      : null
    const returningUser = safeBoolean(value.is_returning_user)
    if (
      metadata === undefined
      || gameTitle !== metadata.title
      || gameVersion === null
      || integrationKind !== 'internal'
      || launchContext === null
      || returningUser === null
    ) return null
    return {
      ...result,
      game_title: gameTitle,
      game_version: gameVersion,
      integration_kind: integrationKind,
      launch_context: launchContext,
      is_returning_user: returningUser,
    }
  }

  if (event === 'game_session_completed') {
    const resultValue = safeResult(value.result)
    const duration = safeInteger(value.duration_seconds, 0, 86_400)
    if (resultValue === null || duration === null) return null
    return { ...result, result: resultValue, duration_seconds: duration }
  }

  if (event === 'game_session_ended') {
    const duration = safeInteger(value.duration_seconds, 0, 86_400)
    const completed = safeBoolean(value.completed)
    const exitReason = safeExitReason(value.exit_reason)
    if (duration === null || completed === null || exitReason === null) return null
    return { ...result, duration_seconds: duration, completed, exit_reason: exitReason }
  }

  const playerCount = safeInteger(value.player_count, 0, 1_000)
  if (playerCount === null) return null
  result.player_count = playerCount

  if (event === 'multiplayer_room_created') {
    const passwordProtected = safeBoolean(value.is_password_protected)
    if (passwordProtected === null) return null
    return { ...result, is_password_protected: passwordProtected }
  }

  if (event === 'multiplayer_room_joined') return result

  const teamCount = optionalInteger(value, 'team_count', 1, 100)
  const goal = optionalInteger(value, 'goal', 0, 1_000_000)
  const betsEnabled = optionalBoolean(value, 'bets_enabled')
  const hostColor = !Object.hasOwn(value, 'host_color') || value.host_color === undefined
    ? undefined
    : safeHostColor(value.host_color)
  const timeControl = !Object.hasOwn(value, 'time_control') || value.time_control === undefined
    ? undefined
    : safeTimeControl(value.time_control)
  if (teamCount === null || goal === null || betsEnabled === null || hostColor === null || timeControl === null) return null
  if (teamCount !== undefined) result.team_count = teamCount
  if (goal !== undefined) result.goal = goal
  if (betsEnabled !== undefined) result.bets_enabled = betsEnabled
  if (hostColor !== undefined) result.host_color = hostColor
  if (timeControl !== undefined) result.time_control = timeControl
  return result
}

export function isOpaqueId(value: unknown) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)
}
