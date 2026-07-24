import type { DesktopPluginDefinition } from '@analytics-games/plugin-sdk'
import { gameShufflePlugin } from '@analytics-games/game-shuffle'
import { paperclipAssistantPlugin } from '@analytics-games/paperclip-assistant'
import { sessionMeterPlugin } from '@analytics-games/session-meter'
import { stickyNotePlugin } from '@analytics-games/sticky-note'

export const DESKTOP_PLUGINS: readonly DesktopPluginDefinition[] = [
  paperclipAssistantPlugin,
  stickyNotePlugin,
  gameShufflePlugin,
  sessionMeterPlugin,
]
