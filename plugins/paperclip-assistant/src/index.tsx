'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { DesktopPluginDefinition, DesktopPluginProps } from '@analytics-games/plugin-sdk'

const tips = [
  'Double-click a desktop icon to launch a game.',
  'External games can leave with the versioned bridge—or you can close their window.',
  'Game authors own gameplay. This desktop owns discovery, entry, and exit.',
]

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
              <button onClick={() => setTipIndex((tipIndex + 1) % tips.length)}>Next tip</button>
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
