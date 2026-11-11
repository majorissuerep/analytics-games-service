'use client'

import { useEffect } from 'react'
import { readyMessage } from '@analytics-games/game-bridge'

export function useAppReady() {
  useEffect(() => {
    document.documentElement.dataset.appReady = 'true'
    if (window.parent !== window) window.parent.postMessage(readyMessage(), window.location.origin)
    return () => { delete document.documentElement.dataset.appReady }
  }, [])
}
