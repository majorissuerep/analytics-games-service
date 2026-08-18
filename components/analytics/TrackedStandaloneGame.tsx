'use client'

import { useEffect, type ReactNode } from 'react'
import type { GameManifest } from '@/lib/engine/types'
import { GAME_COMPLETION_EVENT } from '@/lib/analytics/game-events'
import { useTrackedGameSession } from './useTrackedGameSession'

export function TrackedStandaloneGame({
  game,
  children,
}: {
  game: GameManifest
  children: ReactNode
}) {
  const { completeSession } = useTrackedGameSession(game, 'standalone')

  useEffect(() => {
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<{ result?: unknown }>).detail
      if (typeof detail?.result === 'string') completeSession(detail.result)
    }
    window.addEventListener(GAME_COMPLETION_EVENT, onComplete)
    return () => window.removeEventListener(GAME_COMPLETION_EVENT, onComplete)
  }, [completeSession])

  return children
}
