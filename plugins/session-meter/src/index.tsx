'use client'

import type { DesktopPluginDefinition, DesktopPluginProps } from '@analytics-games/plugin-sdk'
import { useId } from 'react'

function SessionMeter({ context }: DesktopPluginProps) {
  const descriptionId = useId()
  const count = context.gamesCount
  const label = count === 0 ? 'No games installed' : `${count} ${count === 1 ? 'game' : 'games'} installed`
  const explanation = 'Installed games available to play. Upcoming games are not counted.'

  return (
    <span className="session-meter-plugin" role="img" aria-label={label} aria-describedby={descriptionId} title={`${label}. ${explanation}`}>
      <svg aria-hidden="true" width="14" height="12" viewBox="0 0 14 12" fill="none" style={{ flexShrink: 0 }}>
        <path d="M4 3h6c1 0 1.6.6 1.9 1.6l.9 3.6c.3 1.2-1 2-1.9 1.1L9.5 8h-5L3.1 9.3c-.9.9-2.2.1-1.9-1.1l.9-3.6C2.4 3.6 3 3 4 3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M4.5 4.5v3M3 6h3" stroke="currentColor" />
        <circle cx="9" cy="5.5" r=".7" fill="currentColor" />
        <circle cx="11" cy="6.5" r=".7" fill="currentColor" />
      </svg>
      <span aria-hidden="true" style={{ display: 'inline-block', minWidth: '2ch', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      <span id={descriptionId} hidden>{explanation}</span>
    </span>
  )
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
