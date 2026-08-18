'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { GameManifest } from '@/lib/engine/types'
import { useAnalytics } from './AnalyticsProvider'
import {
  trackAnalyticsEvent,
  trackGameSessionStarted,
} from '@/lib/analytics/client'

export type GameLaunchContext = 'desktop' | 'standalone'

export function useTrackedGameSession(game: GameManifest, launchContext: GameLaunchContext) {
  const { consent } = useAnalytics()
  const startedAt = useRef(0)
  const tracked = useRef(false)
  const completed = useRef(false)
  const exitReason = useRef('window_closed')
  const endTimer = useRef<number | null>(null)

  useEffect(() => {
    if (consent !== 'granted' || tracked.current) return
    tracked.current = trackGameSessionStarted({
      game_id: game.id,
      game_title: game.title,
      game_version: game.version,
      integration_kind: game.integration.kind,
      launch_context: launchContext,
    })
    if (tracked.current) startedAt.current = Date.now()
  }, [consent, game.id, game.integration.kind, game.title, game.version, launchContext])

  const completeSession = useCallback((result: string) => {
    if (!tracked.current || completed.current) return
    completed.current = trackAnalyticsEvent('game_session_completed', {
      game_id: game.id,
      result,
      duration_seconds: Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)),
    })
  }, [game.id])

  const markExit = useCallback((reason: string) => {
    exitReason.current = reason.slice(0, 40) || 'unknown'
  }, [])

  useEffect(() => {
    if (endTimer.current) window.clearTimeout(endTimer.current)
    return () => {
      endTimer.current = window.setTimeout(() => {
        if (!tracked.current) return
        trackAnalyticsEvent('game_session_ended', {
          game_id: game.id,
          duration_seconds: Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)),
          completed: completed.current,
          exit_reason: exitReason.current,
        })
      }, 0)
    }
  }, [game.id])

  return { completeSession, markExit }
}
