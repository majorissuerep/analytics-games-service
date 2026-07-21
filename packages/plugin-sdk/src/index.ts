import type { ComponentType } from 'react'

export type DesktopPluginSlot = 'desktop-overlay' | 'tray' | 'start-menu'

export interface DesktopPluginManifest {
  id: string
  version: number
  title: string
  description: string
  slot: DesktopPluginSlot
  defaultEnabled: boolean
}

export interface DesktopPluginContext {
  gamesCount: number
  openGame(gameId: string): void
  openHelp(): void
}

export interface DesktopPluginProps {
  context: DesktopPluginContext
}

export interface DesktopPluginDefinition {
  manifest: DesktopPluginManifest
  Component: ComponentType<DesktopPluginProps>
}
