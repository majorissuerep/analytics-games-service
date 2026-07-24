import type { GameManifest } from '@/lib/engine/types'

export const paintboxManifest = {
  id: 'paintbox',
  version: 1,
  title: 'Paintbox',
  eyebrow: 'Creative classic',
  description: 'A fast browser canvas for doodles, diagrams, and glorious mouse art.',
  accent: '#df2f2f',
  accentSoft: 'linear-gradient(135deg, #fff5ae, #ef5c5c)',
  minPlayers: 1,
  maxPlayers: 1,
  estimatedMinutes: 'As long as inspiration lasts',
  tags: ['solo', 'creative', 'classic'],
  instructions: [
    { title: 'Choose', detail: 'Pick a color and brush size.' },
    { title: 'Draw', detail: 'Drag across the canvas with mouse, pen, or touch.' },
    { title: 'Keep', detail: 'Undo mistakes or save the result as PNG.' },
  ],
  status: 'live',
  integration: { kind: 'internal' },
  icon: '🎨',
} satisfies GameManifest
