export const PLAYER_ID_COOKIE = 'analytics_games_player_id'
export const PLAYER_NAME_COOKIE = 'analytics_games_player_name'

const LEGACY_PLAYER_ID_COOKIE = 'cr_player_id'
const LEGACY_PLAYER_NAME_COOKIE = 'cr_player_name'

export function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const prefix = `${name}=`
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined
}

export function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

export function getOrCreatePlayerId(): string {
  const existing = getCookie(PLAYER_ID_COOKIE) || getCookie(LEGACY_PLAYER_ID_COOKIE)
  if (existing) {
    setCookie(PLAYER_ID_COOKIE, existing)
    return existing
  }
  const id = crypto.randomUUID()
  setCookie(PLAYER_ID_COOKIE, id)
  return id
}

export function getPlayerName(): string {
  const name = getCookie(PLAYER_NAME_COOKIE) || getCookie(LEGACY_PLAYER_NAME_COOKIE) || ''
  if (name) setCookie(PLAYER_NAME_COOKIE, name)
  return name
}

export function setPlayerName(name: string) {
  setCookie(PLAYER_NAME_COOKIE, name)
}
