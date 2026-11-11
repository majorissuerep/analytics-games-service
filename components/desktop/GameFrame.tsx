'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { LoadingState } from '@/components/ui/LoadingState'
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
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const sessionId = useMemo(() => crypto.randomUUID(), [])
  const { completeSession, markExit } = useTrackedGameSession(game, launchContext)
  const src = externalLaunchUrl(game)

  useEffect(() => {
    if (ready || failed) return
    const timer = setTimeout(() => setFailed(true), 45_000)
    return () => clearTimeout(timer)
  }, [attempt, ready, failed])

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
      if (event.data.type === 'game.ready') { setReady(true); setFailed(false); sendInit() }
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
    // The SSR iframe starts blank. Bind the host before navigation so a cached
    // app cannot finish (or emit its only ready event) before React hydrates.
    const frame = frameRef.current
    if (frame && frame.getAttribute('src') !== src) frame.src = src
    return () => window.removeEventListener('message', receive)
  }, [attempt, completeSession, game, markExit, onExit, sessionId, src])

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
      <div className="app-surface redirect-game-panel">
        <h2>{game.title} opens in this tab</h2>
        <p>This game opted out of embedding. It receives a desktop return URL.</p>
        <button onClick={redirect}>Continue to game</button>
      </div>
    )
  }

  return (
    <div className="desktop-game-host">
    <iframe
      key={attempt}
      ref={frameRef}
      className="desktop-game-frame"
      aria-busy={!ready && !failed}
      inert={!ready}
      src="about:blank"
      title={game.title}
      sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups"
      allow="autoplay; fullscreen; gamepad; clipboard-write"
      referrerPolicy="no-referrer"
      allowFullScreen
      onLoad={() => {
        if (frameRef.current?.contentDocument?.URL === 'about:blank') return
        if (game.integration.kind === 'external') { setReady(true); return }
        // Same-origin readiness can also be recovered from the document marker.
        if (frameRef.current?.contentDocument?.documentElement.dataset.appReady === 'true') setReady(true)
      }}
      onError={() => setFailed(true)}
    />
    {!ready && <div className="app-surface desktop-game-loader">{failed ? <section className="ui-card ui-loading-error" role="alert"><h2>{game.title} could not finish opening</h2><p>Try loading the app again or return to the desktop.</p><button className="ui-primary" onClick={() => { setFailed(false); setReady(false); setAttempt(value => value + 1) }}>Retry app</button><button onClick={onExit}>Back to desktop</button></section> : <LoadingState key={attempt} scope="app" label={`Opening ${game.title}`} detail="Loading the app and its controls." onCancel={onExit} cancelLabel="Close app" />}</div>}
    </div>
  )
}
