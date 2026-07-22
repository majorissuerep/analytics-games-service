'use client'

import type { DesktopPluginDefinition, DesktopPluginProps } from '@analytics-games/plugin-sdk'

function SessionMeter({ context }: DesktopPluginProps) {
  return <span className="session-meter-plugin" aria-label={`${context.gamesCount} games installed`}>🎮 {context.gamesCount}</span>
}

export const sessionMeterPlugin: DesktopPluginDefinition = {
  manifest: {
    id: 'session-meter',
    version: 1,
    title: 'Game Counter',
    description: 'Shows the number of installed games in the system tray.',
    slot: 'tray',
    defaultEnabled: true,
  },
  Component: SessionMeter,
}
