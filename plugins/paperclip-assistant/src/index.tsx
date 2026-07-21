'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { DesktopPluginDefinition, DesktopPluginProps } from '@analytics-games/plugin-sdk'

const tips = [
  'Double-click a desktop icon to launch a game.',
  'External games can leave with the versioned bridge—or you can close their window.',
  'Game authors own gameplay. This desktop owns discovery, entry, and exit.',
  'Four teammates and one room code are enough to test a full session.',
  'A minimized game waits on the taskbar without losing its room.',
  'The Start menu knows every registered game, including remote ones.',
  'Private game data stays server-side until your role may see it.',
  'Plugins decorate the desktop; games remain isolated from them.',
  'Try the developer guide when a new game idea starts buzzing.',
  'Window close means back to the desktop—no maze of back buttons.',
  'A good clue sparks alignment without giving the answer away.',
  'Tiny games can reveal surprisingly large differences in assumptions.',
]

function randomTipAfter(current: number) {
  const randomScores = crypto.getRandomValues(new Uint32Array(tips.length))
  let selected: number | null = null

  for (let index = 0; index < tips.length; index += 1) {
    if (index === current) continue
    if (selected === null || randomScores[index] > randomScores[selected]) selected = index
  }

  return selected ?? current
}

function PaperclipAssistant({ context }: DesktopPluginProps) {
  const [visible, setVisible] = useState(true)
  const [tipIndex, setTipIndex] = useState(0)

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          className="paperclip-assistant"
          initial={{ opacity: 0, y: 28, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          aria-label="Pip desktop guide"
        >
          <button className="paperclip-dismiss" onClick={() => setVisible(false)} aria-label="Hide guide">×</button>
          <motion.div
            className="paperclip-character"
            animate={{ rotate: [-4, 4, -4], y: [0, -4, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          >
            <span className="paperclip-loop paperclip-loop-outer" />
            <span className="paperclip-loop paperclip-loop-inner" />
            <span className="paperclip-eye paperclip-eye-left" />
            <span className="paperclip-eye paperclip-eye-right" />
          </motion.div>
          <div className="paperclip-bubble">
            <strong>Pip says:</strong>
            <p>{tips[tipIndex]}</p>
            <div>
              <button onClick={() => setTipIndex((current) => randomTipAfter(current))}>Surprise me</button>
              <button onClick={context.openHelp}>Help</button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

export const paperclipAssistantPlugin: DesktopPluginDefinition = {
  manifest: {
    id: 'paperclip-assistant',
    version: 1,
    title: 'Pip Assistant',
    description: 'Original animated paperclip guide. No Microsoft agent art or audio.',
    slot: 'desktop-overlay',
    defaultEnabled: true,
  },
  Component: PaperclipAssistant,
}
