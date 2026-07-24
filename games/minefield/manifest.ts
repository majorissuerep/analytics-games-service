import type { GameManifest } from '@/lib/engine/types'

export const minefieldManifest = {
  id: 'minefield',
  version: 1,
  title: 'Minefield',
  eyebrow: 'Desktop classic',
  description: 'Clear a safe path, count nearby mines, and mark every danger tile.',
  accent: '#194da9',
  accentSoft: 'linear-gradient(135deg, #d7e8ff, #4b78c8)',
  minPlayers: 1,
  maxPlayers: 1,
  estimatedMinutes: '3–12 min',
  tags: ['solo', 'logic', 'classic'],
  instructions: [
    { title: 'Reveal', detail: 'Click a covered square to reveal it.' },
    { title: 'Read', detail: 'Numbers show how many mines touch that square.' },
    { title: 'Mark', detail: 'Right-click or long-press a square to place a flag.' },
  ],
  status: 'live',
  integration: { kind: 'internal' },
  icon: '💣',
} satisfies GameManifest
