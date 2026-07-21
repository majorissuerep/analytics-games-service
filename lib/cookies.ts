export const PLAYER_ID_COOKIE = 'cr_player_id'
export const PLAYER_NAME_COOKIE = 'cr_player_name'

export function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : undefined
}

export function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

export function getOrCreatePlayerId(): string {
  const existing = getCookie(PLAYER_ID_COOKIE)
  if (existing) return existing
  const id = crypto.randomUUID()
  setCookie(PLAYER_ID_COOKIE, id)
  return id
}

export function getPlayerName(): string {
  return getCookie(PLAYER_NAME_COOKIE) || ''
}

export function setPlayerName(name: string) {
  setCookie(PLAYER_NAME_COOKIE, name)
}
