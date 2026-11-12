import { isWindowSize, resizeMessage } from '@analytics-games/game-bridge'

/** Request outer desktop dimensions after an explicit app layout change. */
export function requestWindowSize(width: number, height: number): void {
  if (typeof window === 'undefined' || window.parent === window || !isWindowSize({ width, height })) return
  window.parent.postMessage(resizeMessage(width, height), window.location.origin)
}
