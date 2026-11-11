'use client'

import { useSyncExternalStore } from 'react'

const key = 'analytics-games.material.v1'
function subscribe(callback: () => void) {
  const query = matchMedia('(prefers-reduced-transparency: reduce), (prefers-contrast: more)')
  addEventListener('storage', callback)
  addEventListener('app-material-change', callback)
  query.addEventListener('change', callback)
  return () => {
    removeEventListener('storage', callback)
    removeEventListener('app-material-change', callback)
    query.removeEventListener('change', callback)
  }
}
function snapshot() {
  let stored = false
  try { stored = localStorage.getItem(key) === 'solid' } catch { /* Use system preference. */ }
  return stored || document.documentElement.dataset.uiMaterial === 'solid' || matchMedia('(prefers-reduced-transparency: reduce), (prefers-contrast: more)').matches
}

export function MaterialPreference() {
  const solid = useSyncExternalStore(subscribe, snapshot, () => false)
  return <label className="ui-material-setting">
    <input type="checkbox" checked={solid} onChange={event => {
      const reduce = event.target.checked
      if (reduce) document.documentElement.dataset.uiMaterial = 'solid'
      else delete document.documentElement.dataset.uiMaterial
      try { if (reduce) localStorage.setItem(key, 'solid'); else localStorage.removeItem(key) } catch { /* Current-page preference still works. */ }
      dispatchEvent(new CustomEvent('app-material-change', { detail: reduce ? 'solid' : 'glass' }))
    }} />
    Reduce transparency
  </label>
}
