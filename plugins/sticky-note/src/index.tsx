'use client'

import { useEffect, useState } from 'react'
import type { DesktopPluginDefinition } from '@analytics-games/plugin-sdk'

const STORAGE_KEY = 'analytics-games.desktop.sticky-note.v1'

function StickyNote() {
  const [note, setNote] = useState('Try a classic game — or write the next team-game idea here.')
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    // Hydrate browser-local content after mount to keep server markup deterministic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved !== null) setNote(saved)
  }, [])

  if (!visible) return null
  return (
    <aside className="sticky-note-plugin" aria-label="Desktop sticky note">
      <header><span>Quick note</span><button onClick={() => setVisible(false)} aria-label="Hide sticky note">×</button></header>
      <textarea
        aria-label="Sticky note text"
        value={note}
        onChange={(event) => {
          setNote(event.target.value)
          localStorage.setItem(STORAGE_KEY, event.target.value)
        }}
      />
    </aside>
  )
}

export const stickyNotePlugin: DesktopPluginDefinition = {
  manifest: {
    id: 'sticky-note',
    version: 1,
    title: 'Sticky Note',
    description: 'Keeps a small browser-local note on the desktop.',
    slot: 'desktop-overlay',
    defaultEnabled: true,
  },
  Component: StickyNote,
}
