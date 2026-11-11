'use client'

import { useEffect, useState } from 'react'
import type { DesktopPluginDefinition } from '@analytics-games/plugin-sdk'
import './sticky-note.css'

const STORAGE_KEY = 'analytics-games.desktop.sticky-note.v1'

function StickyNote() {
  const [note, setNote] = useState('Try a classic game — or write the next team-game idea here.')
  const [visible, setVisible] = useState(true)
  const [editing, setEditing] = useState(false)
  const [storageFailed, setStorageFailed] = useState(false)

  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem(STORAGE_KEY)
    } catch {
      // Keep the scratchpad usable when browser storage is unavailable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStorageFailed(true)
    }
    // Hydrate browser-local content after mount to keep server markup deterministic.
    if (saved !== null) setNote(saved)
  }, [])

  function saveNote(value: string) {
    try {
      localStorage.setItem(STORAGE_KEY, value)
      setStorageFailed(false)
    } catch {
      setStorageFailed(true)
    }
  }

  if (!visible) return null
  return (
    <aside className="app-surface sticky-note-plugin" aria-label="Desktop sticky note">
      <header>
        <div><span className="sticky-note-eyebrow">SCRATCHPAD</span><span className="sticky-note-title">Quick note</span></div>
        <button onClick={() => setVisible(false)} aria-label="Hide sticky note" title="Hide until the desktop reopens">×</button>
      </header>
      <textarea
        aria-label="Sticky note text"
        aria-describedby="sticky-note-save-status"
        placeholder="A thought worth keeping…"
        value={note}
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        onChange={(event) => {
          setNote(event.target.value)
          saveNote(event.target.value)
        }}
      />
      <footer>
        <span id="sticky-note-save-status" role="status">{storageFailed ? 'Not saved. Keep this tab open.' : editing ? 'Editing · saved in this browser' : 'Saved in this browser'}</span>
        {storageFailed && <button onClick={() => saveNote(note)}>Retry save</button>}
      </footer>
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
