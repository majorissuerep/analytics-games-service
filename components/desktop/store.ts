'use client'

import { create } from 'zustand'

export type SystemWindowId = 'welcome' | 'plugins' | 'help'

export interface DesktopWindowState {
  id: string
  title: string
  kind: 'game' | 'system'
  gameId?: string
  systemId?: SystemWindowId
  minimized: boolean
  maximized: boolean
  zIndex: number
}

interface DesktopState {
  windows: DesktopWindowState[]
  startOpen: boolean
  openGame(gameId: string, title: string): void
  openSystem(systemId: SystemWindowId, title: string): void
  closeWindow(id: string): void
  minimizeWindow(id: string): void
  toggleMaximize(id: string): void
  focusWindow(id: string): void
  setStartOpen(open: boolean): void
}

export function focus(windows: DesktopWindowState[], id: string) {
  const target = windows.find(window => window.id === id)
  if (!target) return windows
  const ordered = [...windows].sort((a, b) => a.zIndex - b.zIndex)
  if (!target.minimized && ordered.filter(window => !window.minimized).at(-1)?.id === id) return windows
  const ids = [...ordered.filter(window => window.id !== id), target].map(window => window.id)
  return windows.map(window => ({ ...window, minimized: window.id === id ? false : window.minimized, zIndex: ids.indexOf(window.id) + 1 }))
}

export const useDesktopStore = create<DesktopState>((set) => ({
  windows: [{
    id: 'system:welcome',
    title: 'Welcome to Analytics Games',
    kind: 'system',
    systemId: 'welcome',
    minimized: false,
    maximized: false,
    zIndex: 1,
  }],
  startOpen: false,
  openGame(gameId, title) {
    set((state) => {
      const id = `game:${gameId}`
      const existing = state.windows.some((window) => window.id === id)
      return {
        windows: existing
          ? focus(state.windows, id)
          : [...state.windows, {
            id,
            title,
            kind: 'game',
            gameId,
            minimized: false,
            maximized: false,
            zIndex: state.windows.length + 1,
          }],
        startOpen: false,
      }
    })
  },
  openSystem(systemId, title) {
    set((state) => {
      const id = `system:${systemId}`
      const existing = state.windows.some((window) => window.id === id)
      return {
        windows: existing
          ? focus(state.windows, id)
          : [...state.windows, {
            id,
            title,
            kind: 'system',
            systemId,
            minimized: false,
            maximized: false,
            zIndex: state.windows.length + 1,
          }],
        startOpen: false,
      }
    })
  },
  closeWindow(id) {
    set((state) => ({ windows: state.windows.filter((window) => window.id !== id).sort((a, b) => a.zIndex - b.zIndex).map((window, index) => ({ ...window, zIndex: index + 1 })) }))
  },
  minimizeWindow(id) {
    set((state) => ({
      windows: state.windows.map((window) => window.id === id
        ? { ...window, minimized: true }
        : window),
    }))
  },
  toggleMaximize(id) {
    set((state) => ({
      windows: state.windows.map((window) => window.id === id
        ? { ...window, maximized: !window.maximized, minimized: false }
        : window),
    }))
  },
  focusWindow(id) {
    set((state) => {
      const windows = focus(state.windows, id)
      return windows === state.windows ? state : { windows }
    })
  },
  setStartOpen(open) {
    set({ startOpen: open })
  },
}))
