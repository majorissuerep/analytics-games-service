import type { GameManifest } from '@/lib/engine/types'

export const chessManifest = {
  id: 'chess',
  version: 1,
  title: 'Chess',
  eyebrow: 'Classic strategy',
  description: 'Play legal classical chess locally, against a bot, or in a password-protected online room.',
  accent: '#7a4f2b',
  accentSoft: 'linear-gradient(135deg, #f0d9b5, #8b5e3c)',
  minPlayers: 1,
  maxPlayers: 2,
  estimatedMinutes: '5–45 min',
  tags: ['strategy', 'rooms', 'bot', 'classic'],
  instructions: [
    { title: 'Choose a mode', detail: 'Play a bot, pass the board locally, or create/join an online room.' },
    { title: 'Pick a color', detail: 'Choose White, Black, or Random before the game starts.' },
    { title: 'Move', detail: 'Select a piece, then a highlighted legal destination. Checkmate wins.' },
  ],
  preferredWindow: { width: 980, height: 760 },
  status: 'live',
  integration: { kind: 'internal' },
  icon: '♟️',
} satisfies GameManifest
