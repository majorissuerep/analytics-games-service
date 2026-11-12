import type { GameManifest } from '@/lib/engine/types'

export const minefieldManifest = {
  id: 'minefield',
  version: 2,
  preferredWindow: { width: 480, height: 600 },
  title: 'Minefield',
  eyebrow: 'Desktop classic',
  description: 'Deduction-only classic boards and linked-layer Extreme Elite, with inspectable clue proofs.',
  accent: '#354d5c',
  accentSoft: 'linear-gradient(135deg, #e6eef3, #8da7b7)',
  minPlayers: 1,
  maxPlayers: 1,
  estimatedMinutes: '3–12 min',
  tags: ['solo', 'logic', 'classic'],
  instructions: [
    { title: 'Reveal', detail: 'Click or press Enter. Local numbers count touching mines; the first opening and its local neighbors are safe.' },
    { title: 'Mark', detail: 'Right-click, press F, or hold a covered square to mark it.' },
    { title: 'Explain', detail: 'Explain move shows visible clue values, regions and supporting deductions. Flags are notes, never proof.' },
    { title: 'Extreme Elite', detail: 'Two 8×8 layers, 28 mines. E or Scan echo on a revealed clue counts the other layer’s aligned 3×3. Scans are unlimited and counted. C or Shift-click clears local neighbors.' },
  ],
  status: 'live',
  integration: { kind: 'internal' },
  icon: '💣',
} satisfies GameManifest
