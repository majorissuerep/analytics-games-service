'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Rnd } from 'react-rnd'
import type { DesktopPluginContext, DesktopPluginSlot } from '@analytics-games/plugin-sdk'
import type { GameManifest } from '@/lib/engine/types'
import { DESKTOP_PLUGINS } from '@/plugins/registry'
import { GameFrame } from './GameFrame'
import { useDesktopStore, type DesktopWindowState } from './store'
import 'xp.css/dist/XP.css'
import './desktop.css'

interface DesktopShellProps {
  games: GameManifest[]
}

const PLUGIN_STORAGE_KEY = 'analytics-games.desktop.plugins.v1'

function windowDefaults(window: DesktopWindowState, index: number) {
  if (window.kind === 'game') {
    return { x: 72 + index * 18, y: 42 + index * 16, width: 1040, height: 700 }
  }
  return { x: 150 + index * 24, y: 90 + index * 18, width: 620, height: 430 }
}

export function DesktopShell({ games }: DesktopShellProps) {
  const [clock, setClock] = useState('')
  const [enabledPlugins, setEnabledPlugins] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DESKTOP_PLUGINS.map((plugin) => [plugin.manifest.id, plugin.manifest.defaultEnabled])),
  )
  const {
    windows,
    startOpen,
    openGame,
    openSystem,
    closeWindow,
    minimizeWindow,
    toggleMaximize,
    focusWindow,
    setStartOpen,
  } = useDesktopStore()
  const gamesById = useMemo(() => new Map(games.map((game) => [game.id, game])), [games])

  useEffect(() => {
    const update = () => setClock(new Intl.DateTimeFormat(undefined, {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date()))
    update()
    const timer = window.setInterval(update, 1_000)
    return () => window.clearInterval(timer)
  }, [])

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

  const pluginContext: DesktopPluginContext = {
    gamesCount: games.length,
    games: games.map(({ id, title, icon }) => ({ id, title, icon })),
    openGame: (gameId) => {
      const game = gamesById.get(gameId)
      if (game) openGame(game.id, game.title)
    },
    openHelp: () => openSystem('help', 'Platform Help'),
  }

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
            aria-label={`Open ${game.title}`}
          >
            <span className="desktop-icon-art" style={{ background: game.accentSoft }}>{game.icon ?? '🎮'}</span>
            <span>{game.title}</span>
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

      <section className="desktop-windows" aria-live="polite">
        {windows.map((window, index) => {
          if (window.minimized) return null
          const defaults = windowDefaults(window, index)
          return (
            <Rnd
              key={window.id}
              default={defaults}
              size={window.maximized ? { width: '100%', height: 'calc(100% - 42px)' } : undefined}
              position={window.maximized ? { x: 0, y: 0 } : undefined}
              disableDragging={window.maximized}
              enableResizing={!window.maximized}
              minWidth={window.kind === 'game' ? 560 : 360}
              minHeight={window.kind === 'game' ? 400 : 260}
              bounds="parent"
              dragHandleClassName="title-bar"
              style={{ zIndex: window.zIndex }}
              className="desktop-rnd-window"
              onMouseDown={() => focusWindow(window.id)}
            >
              <article className="window desktop-window">
                <div className="title-bar" onDoubleClick={() => toggleMaximize(window.id)}>
                  <div className="title-bar-text"><span aria-hidden>{window.kind === 'game' ? '🎮' : '🖥️'}</span> {window.title}</div>
                  <div className="title-bar-controls">
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
                    openGame={(game) => openGame(game.id, game.title)}
                    close={() => closeWindow(window.id)}
                  />
                </div>
              </article>
            </Rnd>
          )
        })}
      </section>

      <PluginSlot slot="desktop-overlay" enabled={enabledPlugins} context={pluginContext} />

      {startOpen && (
        <nav className="start-menu window" onClick={(event) => event.stopPropagation()} aria-label="Start menu">
          <div className="start-menu-banner"><strong>Analytics</strong><span>Games</span></div>
          <div className="start-menu-items">
            {games.map((game) => (
              <button key={game.id} onClick={() => openGame(game.id, game.title)}>
                <span>{game.icon ?? '🎮'}</span><div><strong>{game.title}</strong><small>{game.description}</small></div>
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
  openGame,
  close,
}: {
  window: DesktopWindowState
  games: GameManifest[]
  plugins: Record<string, boolean>
  setPlugin(id: string, enabled: boolean): void
  openGame(game: GameManifest): void
  close(): void
}) {
  if (window.kind === 'game' && window.gameId) {
    const game = games.find((candidate) => candidate.id === window.gameId)
    return game ? <GameFrame game={game} onExit={close} /> : <p>Game is no longer registered.</p>
  }

  if (window.systemId === 'plugins') {
    return (
      <div className="system-panel plugin-manager">
        <header><h2>Installed desktop plugins</h2><p>Build-time packages with typed, explicit desktop slots.</p></header>
        {DESKTOP_PLUGINS.map((plugin) => (
          <label className="plugin-row" key={plugin.manifest.id}>
            <input
              type="checkbox"
              checked={Boolean(plugins[plugin.manifest.id])}
              onChange={(event) => setPlugin(plugin.manifest.id, event.target.checked)}
            />
            <span><strong>{plugin.manifest.title}</strong><small>{plugin.manifest.description}</small></span>
            <code>v{plugin.manifest.version}</code>
          </label>
        ))}
      </div>
    )
  }

  if (window.systemId === 'help') {
    return (
      <div className="system-panel help-panel">
        <h2>Bring any web game</h2>
        <ol>
          <li>Host game anywhere over HTTPS.</li>
          <li>Implement bridge v1: <code>game.ready</code> and <code>game.exit</code>.</li>
          <li>Register strict manifest through platform API.</li>
          <li>Desktop handles discovery, window, entry, focus, and exit.</li>
        </ol>
        <p>Internal games can additionally use shared rooms, actions, projections, and leaderboards.</p>
        <Link href="/develop">Open full developer guide →</Link>
      </div>
    )
  }

  return (
    <div className="system-panel welcome-panel">
      <div className="welcome-logo" aria-hidden><span>AG</span></div>
      <div>
        <p className="welcome-kicker">ANALYTICS GAMES DESKTOP</p>
        <h1>Team games live here.</h1>
        <p>Double-click a game icon. Local modules and independently hosted games launch through the same desktop.</p>
        <div className="welcome-actions">
          {games.slice(0, 3).map((game) => <button key={game.id} onClick={() => openGame(game)}>Open {game.title}</button>)}
          <Link href="/develop">Developer guide</Link>
        </div>
      </div>
    </div>
  )
}
