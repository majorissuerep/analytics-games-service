'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Rnd } from 'react-rnd'
import type { DesktopPluginContext, DesktopPluginSlot } from '@analytics-games/plugin-sdk'
import type { GameManifest } from '@/lib/engine/types'
import { DESKTOP_PLUGINS } from '@/plugins/registry'
import { useAnalytics } from '@/components/analytics/AnalyticsProvider'
import { trackAnalyticsEventOnce } from '@/lib/analytics/client'
import { GameIcon } from '@/components/games/GameIcon'
import { ComingSoonGame } from '@/components/games/ComingSoonGame'
import { GameFrame } from './GameFrame'
import { useDesktopStore, type DesktopWindowState } from './store'
import 'xp.css/dist/XP.css'
import { WelcomeApp } from './apps/WelcomeApp'
import { HelpApp } from './apps/HelpApp'
import { PluginManagerApp } from './apps/PluginManagerApp'
import './desktop.css'

interface DesktopShellProps {
  games: GameManifest[]
}

const PLUGIN_STORAGE_KEY = 'analytics-games.desktop.plugins.v1'

type WindowRect = { x: number; y: number; width: number; height: number }
const SYSTEM_SIZES = { welcome: { width: 620, height: 430 }, help: { width: 720, height: 620 }, plugins: { width: 620, height: 520 } }

function clampRect(rect: WindowRect, viewport: { width: number; height: number }): WindowRect {
  const width = Math.min(rect.width, viewport.width)
  const height = Math.min(rect.height, viewport.height)
  return { width, height, x: Math.max(0, Math.min(rect.x, viewport.width - width)), y: Math.max(0, Math.min(rect.y, viewport.height - height)) }
}

function windowDefaults(window: DesktopWindowState, index: number, viewport: { width: number; height: number }, game?: GameManifest) {
  const preferred = window.kind === 'game' ? game?.preferredWindow ?? { width: 960, height: 720 } : SYSTEM_SIZES[window.systemId ?? 'welcome']
  return clampRect({ ...preferred, x: 72 + index * 24, y: 42 + index * 18 }, viewport)
}

export function DesktopShell({ games }: DesktopShellProps) {
  const { consent } = useAnalytics()
  const [clock, setClock] = useState('')
  const [draggingWindow, setDraggingWindow] = useState<string | null>(null)
  const [interactionCursor, setInteractionCursor] = useState('grabbing')
  const workspaceRef = useRef<HTMLElement>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [restoredRects, setRestoredRects] = useState<Record<string, WindowRect>>({})
  const [enabledPlugins, setEnabledPlugins] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DESKTOP_PLUGINS.map((plugin) => [plugin.manifest.id, plugin.manifest.defaultEnabled])),
  )
  const {
    windows,
    startOpen,
    openGame: openStoredGame,
    openSystem: openStoredSystem,
    closeWindow: closeStoredWindow,
    minimizeWindow,
    toggleMaximize: toggleStoredMaximize,
    focusWindow,
    setStartOpen,
  } = useDesktopStore()
  const playableGames = games.filter(game => game.status !== 'coming-soon')
  const gamesById = useMemo(() => new Map(games.map((game) => [game.id, game])), [games])

  useEffect(() => {
    if (consent !== 'granted') return
    trackAnalyticsEventOnce('platform_viewed', 'platform_viewed', {
      games_available: playableGames.length,
      path: '/',
    })
  }, [consent, playableGames.length])

  useEffect(() => {
    const update = () => setClock(new Intl.DateTimeFormat(undefined, {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date()))
    update()
    const timer = window.setInterval(update, 1_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace) return
    const updateViewport = () => {
      const size = { width: workspace.clientWidth, height: workspace.clientHeight }
      setViewport(size)
      setRestoredRects(current => {
        const next = { ...current }
        for (const [index, window] of useDesktopStore.getState().windows.entries()) {
          if (!next[window.id]) next[window.id] = windowDefaults(window, index, size, window.gameId ? gamesById.get(window.gameId) : undefined)
        }
        return next
      })
    }
    updateViewport()
    const observer = new ResizeObserver(updateViewport)
    observer.observe(workspace)
    return () => observer.disconnect()
  }, [gamesById])

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PLUGIN_STORAGE_KEY) ?? '{}') as Record<string, unknown>
      // Hydrate browser-local preferences only after client mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEnabledPlugins((current) => Object.fromEntries(
        Object.entries(current).map(([id, fallback]) => [id, typeof stored[id] === 'boolean' ? stored[id] : fallback]),
      ))
    } catch {
      localStorage.removeItem(PLUGIN_STORAGE_KEY)
    }
  }, [])

  const setPlugin = useCallback((id: string, enabled: boolean) => {
    setEnabledPlugins((current) => {
      const next = { ...current, [id]: enabled }
      localStorage.setItem(PLUGIN_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const openGame = (gameId: string, title: string) => {
    if (!windows.some(window => window.id === `game:${gameId}`)) {
      const game = gamesById.get(gameId)
      const defaults = windowDefaults({ id: `game:${gameId}`, title, kind: 'game', gameId, minimized: false, maximized: false, zIndex: 0 }, windows.length, viewport, game)
      setRestoredRects(current => ({ ...current, [`game:${gameId}`]: defaults }))
    }
    openStoredGame(gameId, title)
  }
  const openSystem = (systemId: 'welcome' | 'help' | 'plugins', title: string) => {
    if (!windows.some(window => window.id === `system:${systemId}`)) {
      const defaults = windowDefaults({ id: `system:${systemId}`, title, kind: 'system', systemId, minimized: false, maximized: false, zIndex: 0 }, windows.length, viewport)
      setRestoredRects(current => ({ ...current, [`system:${systemId}`]: defaults }))
    }
    openStoredSystem(systemId, title)
  }
  const closeWindow = (id: string) => {
    closeStoredWindow(id)
    setRestoredRects(current => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }
  const toggleMaximize = (id: string) => {
    const target = windows.find(candidate => candidate.id === id)
    if (target && !target.maximized) {
      const defaults = windowDefaults(target, windows.indexOf(target), viewport, target.gameId ? gamesById.get(target.gameId) : undefined)
      setRestoredRects(current => current[id] ? current : { ...current, [id]: defaults })
    }
    toggleStoredMaximize(id)
  }

  const pluginContext: DesktopPluginContext = {
    applicationActive: windows.some(window => !window.minimized && window.systemId !== 'welcome'),
    gamesCount: playableGames.length,
    games: playableGames.map(({ id, title, icon }) => ({ id, title, icon })),
    openGame: (gameId) => {
      const game = gamesById.get(gameId)
      if (game) openGame(game.id, game.title)
    },
    openHelp: () => openSystem('help', 'Platform Help'),
  }

  const topFocusedId = windows.filter(candidate => !candidate.minimized).reduce<DesktopWindowState | undefined>((top, candidate) => !top || candidate.zIndex > top.zIndex ? candidate : top, undefined)?.id

  return (
    <main className="millennium-desktop" onClick={() => startOpen && setStartOpen(false)}>
      <div className="desktop-sky" aria-hidden />

      <section className="desktop-icons" aria-label="Games and platform tools">
        {games.map((game) => (
          <button
            className="desktop-icon"
            key={game.id}
            onDoubleClick={() => openGame(game.id, game.title)}
            onClick={(event) => event.detail === 1 && focusWindow(`game:${game.id}`)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                openGame(game.id, game.title)
              }
            }}
            aria-label={game.status === 'coming-soon' ? `${game.title} — Coming soon` : `Open ${game.title}`}
          >
            <span className="desktop-icon-art" style={{ background: game.accentSoft }}><GameIcon icon={game.icon} /></span>
            <span>{game.title}</span>
            {game.status === 'coming-soon' && <small className="desktop-coming-soon">Coming soon</small>}
            {game.integration.kind === 'external' && <small>web link</small>}
          </button>
        ))}
        <button
          className="desktop-icon"
          onDoubleClick={() => openSystem('plugins', 'Plugin Manager')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openSystem('plugins', 'Plugin Manager')
            }
          }}
        >
          <span className="desktop-icon-art desktop-plugin-art">🧩</span>
          <span>Plugins</span>
        </button>
        <button
          className="desktop-icon"
          onDoubleClick={() => openSystem('help', 'Platform Help')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openSystem('help', 'Platform Help')
            }
          }}
        >
          <span className="desktop-icon-art desktop-help-art">?</span>
          <span>Build a game</span>
        </button>
      </section>

      <section ref={workspaceRef} className="desktop-windows" aria-live="polite">
        {windows.map((window, index) => {
          if (window.minimized || !viewport.width || !viewport.height) return null
          const defaults = windowDefaults(
            window,
            index,
            viewport,
            window.gameId ? gamesById.get(window.gameId) : undefined,
          )
          const restored = restoredRects[window.id] ?? defaults
          const rect = window.maximized ? { x: 0, y: 0, ...viewport } : clampRect(restored, viewport)
          return (
            <Rnd
              key={window.id}
              size={{ width: rect.width, height: rect.height }}
              position={{ x: rect.x, y: rect.y }}
              disableDragging={window.maximized}
              enableResizing={!window.maximized}
              minWidth={Math.min(280, defaults.width, viewport.width)}
              minHeight={Math.min(180, defaults.height, viewport.height)}
              maxWidth={viewport.width}
              maxHeight={viewport.height}
              bounds="parent"
              dragHandleClassName="title-bar"
              style={{ zIndex: window.zIndex }}
              className="desktop-rnd-window"
              onPointerDownCapture={() => focusWindow(window.id)}
              onFocusCapture={() => focusWindow(window.id)}
              onDragStart={() => { setInteractionCursor('grabbing'); setDraggingWindow(window.id) }}
              onResizeStart={(event) => {
                setInteractionCursor(event.target instanceof Element ? getComputedStyle(event.target).cursor : 'nwse-resize')
                setDraggingWindow(window.id)
              }}
              onDragStop={(_, position) => {
                setDraggingWindow(null)
                setRestoredRects(current => ({ ...current, [window.id]: clampRect({ ...rect, x: position.x, y: position.y }, viewport) }))
              }}
              onResizeStop={(_, __, element, ___, position) => {
                setDraggingWindow(null)
                setRestoredRects(current => ({ ...current, [window.id]: clampRect({ ...position, width: element.offsetWidth, height: element.offsetHeight }, viewport) }))
              }}
            >
              <article className="window desktop-window" data-window-id={window.id} data-focused={topFocusedId === window.id}>
                <div className="title-bar" onDoubleClick={() => toggleMaximize(window.id)}>
                  <div className="title-bar-text"><span aria-hidden>{window.kind === 'game' ? '🎮' : '🖥️'}</span> {window.title}</div>
                  <div className="title-bar-controls" onMouseDown={(event) => event.stopPropagation()}>
                    <button aria-label="Minimize" onClick={() => minimizeWindow(window.id)} />
                    <button aria-label={window.maximized ? 'Restore' : 'Maximize'} onClick={() => toggleMaximize(window.id)} />
                    <button aria-label="Close" onClick={() => closeWindow(window.id)} />
                  </div>
                </div>
                <div className="desktop-window-body">
                  <WindowContent
                    window={window}
                    games={games}
                    plugins={enabledPlugins}
                    setPlugin={setPlugin}
                    focused={topFocusedId === window.id}
                    activate={() => focusWindow(window.id)}
                    requestSize={(width, height) => setRestoredRects(current => ({ ...current, [window.id]: { ...restored, width, height } }))}
                    openGame={(game) => openGame(game.id, game.title)}
                    close={() => closeWindow(window.id)}
                  />
                </div>
              </article>
            </Rnd>
          )
        })}
        {draggingWindow && <div className="desktop-drag-shield" style={{ cursor: interactionCursor }} aria-hidden data-dragging-window={draggingWindow} />}
      </section>

      <PluginSlot slot="desktop-overlay" enabled={enabledPlugins} context={pluginContext} />

      {startOpen && (
        <nav className="start-menu window" onClick={(event) => event.stopPropagation()} aria-label="Start menu">
          <div className="start-menu-banner"><strong>Analytics</strong><span>Games</span></div>
          <div className="start-menu-items">
            {games.map((game) => (
              <button key={game.id} onClick={() => openGame(game.id, game.title)}>
                <span><GameIcon icon={game.icon} size={28} /></span><div><strong>{game.title}</strong><small>{game.status === 'coming-soon' ? 'Coming soon · ' : ''}{game.description}</small></div>
              </button>
            ))}
            <PluginSlot slot="start-menu" enabled={enabledPlugins} context={pluginContext} />
            <hr />
            <button onClick={() => openSystem('plugins', 'Plugin Manager')}><span>🧩</span><strong>Plugin Manager</strong></button>
            <button onClick={() => openSystem('help', 'Platform Help')}><span>📘</span><strong>Developer Guide</strong></button>
          </div>
        </nav>
      )}

      <footer className="desktop-taskbar" onClick={(event) => event.stopPropagation()}>
        <button className={`start-button${startOpen ? ' active' : ''}`} onClick={() => setStartOpen(!startOpen)}>
          <span className="start-mark" aria-hidden>◆</span><strong>start</strong>
        </button>
        <div className="taskbar-windows">
          {windows.map((window) => (
            <button key={window.id} className={window.minimized ? '' : 'active'} onClick={() => focusWindow(window.id)}>
              {window.kind === 'game' ? '🎮' : '🖥️'} {window.title}
            </button>
          ))}
        </div>
        <div className="taskbar-tray">
          <div id="desktop-assistant-launcher" />
          <div id="desktop-privacy-launcher" />
          <PluginSlot slot="tray" enabled={enabledPlugins} context={pluginContext} />
          <span aria-hidden>🔊</span><time>{clock}</time>
        </div>
      </footer>
    </main>
  )
}

function PluginSlot({
  slot,
  enabled,
  context,
}: {
  slot: DesktopPluginSlot
  enabled: Record<string, boolean>
  context: DesktopPluginContext
}) {
  return DESKTOP_PLUGINS
    .filter((plugin) => plugin.manifest.slot === slot && enabled[plugin.manifest.id])
    .map((plugin) => <plugin.Component key={plugin.manifest.id} context={context} />)
}

function WindowContent({
  window,
  games,
  plugins,
  setPlugin,
  focused,
  activate,
  requestSize,
  openGame,
  close,
}: {
  window: DesktopWindowState
  games: GameManifest[]
  plugins: Record<string, boolean>
  setPlugin(id: string, enabled: boolean): void
  focused: boolean
  activate(): void
  requestSize(width: number, height: number): void
  openGame(game: GameManifest): void
  close(): void
}) {
  if (window.kind === 'game' && window.gameId) {
    const game = games.find((candidate) => candidate.id === window.gameId)
    if (!game) return <p>Game is no longer registered.</p>
    if (game.status === 'coming-soon') return <ComingSoonGame game={game} onExit={close} />
    // Externally hosted games keep playing (audio included) while their iframe
    // is mounted, so an unfocused window is suspended: the iframe unmounts and
    // a paused placeholder takes its place. Internal games stay mounted and
    // keep their state.
    if (game.integration.kind === 'external' && !focused) {
      return (
        <div className="app-surface external-game-suspended">
          <p><strong>{game.title} is paused</strong></p>
          <p>Its audio and animation stop while another window is active. Click this window to resume.</p>
        </div>
      )
    }
    return <GameFrame game={game} onExit={close} onActivate={activate} onRequestSize={requestSize} />
  }

  if (window.systemId === 'plugins') return <PluginManagerApp plugins={plugins} setPlugin={setPlugin} />
  if (window.systemId === 'help') return <HelpApp />
  return <WelcomeApp games={games} openGame={openGame} />
}
