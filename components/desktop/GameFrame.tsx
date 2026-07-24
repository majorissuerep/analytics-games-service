'use client'

import { useEffect, useMemo, useRef } from 'react'
import {
  ANALYTICS_GAME_BRIDGE,
  ANALYTICS_GAME_BRIDGE_VERSION,
  isGameToHostMessage,
  type HostInitMessage,
} from '@analytics-games/game-bridge'
import type { GameManifest } from '@/lib/engine/types'

interface GameFrameProps {
  game: GameManifest
  onExit(): void
}

function externalLaunchUrl(game: GameManifest) {
  if (game.integration.kind !== 'external') {
    return game.integration.launchPath ?? `/games/${encodeURIComponent(game.id)}?embedded=1`
  }
  const url = new URL(game.integration.launchUrl)
  url.searchParams.set('ag_bridge', String(ANALYTICS_GAME_BRIDGE_VERSION))
  return url.toString()
}

export function GameFrame({ game, onExit }: GameFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const sessionId = useMemo(() => crypto.randomUUID(), [])
  const src = externalLaunchUrl(game)

  useEffect(() => {
    if (game.integration.kind !== 'external') return
    const targetOrigin = game.integration.origin

    const sendInit = () => {
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
      if (!isGameToHostMessage(event.data)) return
      if (event.data.type === 'game.ready') sendInit()
      if (event.data.type === 'game.exit') onExit()
    }

    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [game, onExit, sessionId])

  if (game.integration.kind === 'external' && game.integration.openMode === 'redirect') {
    const integration = game.integration
    const redirect = () => {
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
