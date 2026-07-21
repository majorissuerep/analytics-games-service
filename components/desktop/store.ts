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
  nextZ: number
  startOpen: boolean
  openGame(gameId: string, title: string): void
  openSystem(systemId: SystemWindowId, title: string): void
  closeWindow(id: string): void
  minimizeWindow(id: string): void
  toggleMaximize(id: string): void
  focusWindow(id: string): void
  setStartOpen(open: boolean): void
}

function focus(windows: DesktopWindowState[], id: string, zIndex: number) {
  return windows.map((window) => window.id === id
    ? { ...window, minimized: false, zIndex }
    : window)
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
  nextZ: 2,
  startOpen: false,
  openGame(gameId, title) {
    set((state) => {
      const id = `game:${gameId}`
      const existing = state.windows.some((window) => window.id === id)
      return {
        windows: existing
          ? focus(state.windows, id, state.nextZ)
          : [...state.windows, {
            id,
            title,
            kind: 'game',
            gameId,
            minimized: false,
            maximized: false,
            zIndex: state.nextZ,
          }],
        nextZ: state.nextZ + 1,
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
          ? focus(state.windows, id, state.nextZ)
          : [...state.windows, {
            id,
            title,
            kind: 'system',
            systemId,
            minimized: false,
            maximized: false,
            zIndex: state.nextZ,
          }],
        nextZ: state.nextZ + 1,
        startOpen: false,
      }
    })
  },
  closeWindow(id) {
    set((state) => ({ windows: state.windows.filter((window) => window.id !== id) }))
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
    set((state) => ({
      windows: focus(state.windows, id, state.nextZ),
      nextZ: state.nextZ + 1,
    }))
  },
  setStartOpen(open) {
    set({ startOpen: open })
  },
}))
