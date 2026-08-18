'use client'

import { useEffect, useMemo, useRef } from 'react'
import {
  ANALYTICS_GAME_BRIDGE,
  ANALYTICS_GAME_BRIDGE_VERSION,
  isGameToHostMessage,
  type HostInitMessage,
} from '@analytics-games/game-bridge'
import type { GameManifest } from '@/lib/engine/types'
import {
  gameCompletionFromMessage,
  gameExitReasonFromMessage,
} from '@/lib/analytics/game-events'
import { readInternalAnalyticsRelay } from '@/lib/analytics/internal-relay'
import { trackAnalyticsEvent } from '@/lib/analytics/client'
import {
  useTrackedGameSession,
  type GameLaunchContext,
} from '@/components/analytics/useTrackedGameSession'

interface GameFrameProps {
  game: GameManifest
  onExit(): void
  launchContext?: GameLaunchContext
}

function externalLaunchUrl(game: GameManifest) {
  if (game.integration.kind !== 'external') {
    return game.integration.launchPath ?? `/games/${encodeURIComponent(game.id)}?embedded=1`
  }
  const url = new URL(game.integration.launchUrl)
  url.searchParams.set('ag_bridge', String(ANALYTICS_GAME_BRIDGE_VERSION))
  return url.toString()
}

export function GameFrame({ game, onExit, launchContext = 'desktop' }: GameFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const sessionId = useMemo(() => crypto.randomUUID(), [])
  const { completeSession, markExit } = useTrackedGameSession(game, launchContext)
  const src = externalLaunchUrl(game)

  useEffect(() => {
    const targetOrigin = game.integration.kind === 'external'
      ? game.integration.origin
      : window.location.origin

    const sendInit = () => {
      if (game.integration.kind !== 'external') return
      const message: HostInitMessage = {
        protocol: ANALYTICS_GAME_BRIDGE,
        version: ANALYTICS_GAME_BRIDGE_VERSION,
        type: 'host.init',
        payload: {
          gameId: game.id,
          sessionId,
          locale: navigator.language,
          theme: 'millennium',
          returnUrl: window.location.origin,
          capabilities: ['exit', 'focus', 'telemetry'],
        },
      }
      frameRef.current?.contentWindow?.postMessage(message, targetOrigin)
    }

    const receive = (event: MessageEvent) => {
      if (event.origin !== targetOrigin || event.source !== frameRef.current?.contentWindow) return
      if (game.integration.kind === 'internal') {
        const relay = readInternalAnalyticsRelay(event.data, game.id)
        if (relay) {
          trackAnalyticsEvent(relay.event, relay.properties)
          return
        }
      }
      if (!isGameToHostMessage(event.data)) return
      if (event.data.type === 'game.ready') sendInit()
      const completion = gameCompletionFromMessage(event.data)
      if (completion) completeSession(completion)
      if (event.data.type === 'game.exit') {
        const reason = gameExitReasonFromMessage(event.data) ?? 'error'
        markExit(reason)
        if (reason === 'complete') completeSession('completed')
        onExit()
      }
    }

    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [completeSession, game, markExit, onExit, sessionId])

  if (game.integration.kind === 'external' && game.integration.openMode === 'redirect') {
    const integration = game.integration
    const redirect = () => {
      markExit('redirected')
      const url = new URL(integration.launchUrl)
      url.searchParams.set('ag_bridge', String(ANALYTICS_GAME_BRIDGE_VERSION))
      url.searchParams.set('ag_host_origin', window.location.origin)
      url.searchParams.set('ag_return_url', window.location.origin)
      window.location.assign(url)
    }
    return (
      <div className="redirect-game-panel">
        <h2>{game.title} opens in this tab</h2>
        <p>This game opted out of embedding. It receives a desktop return URL.</p>
        <button onClick={redirect}>Continue to game</button>
      </div>
    )
  }

  return (
    <iframe
      ref={frameRef}
      className="desktop-game-frame"
      src={src}
      title={game.title}
      sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups"
      allow="autoplay; fullscreen; gamepad; clipboard-write"
      referrerPolicy="no-referrer"
      allowFullScreen
    />
  )
}
