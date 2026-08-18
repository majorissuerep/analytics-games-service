import type { GameManifest } from '@/lib/engine/types'

export const orbitPinballManifest = {
  id: 'orbit-pinball',
  version: 3,
  title: 'Pinball',
  eyebrow: 'Arcade classic',
  description: 'An original pinball table with custom physics, flippers, bumpers, slingshots, drop targets, spinner, and multiball.',
  accent: '#ffb000',
  accentSoft: 'linear-gradient(135deg, #1a1a3e, #f05a38)',
  minPlayers: 1,
  maxPlayers: 1,
  estimatedMinutes: '2–10 min',
  tags: ['solo', 'arcade', 'classic', 'physics'],
  instructions: [
    { title: 'Launch', detail: 'Hold Space to charge the plunger, release to launch the ball.' },
    { title: 'Flippers', detail: 'Use arrow keys or A/D for left and right flippers. Or tap the table sides.' },
    { title: 'Score', detail: 'Hit bumpers, knock down drop targets, spin the spinner, and chain combos for multipliers.' },
  ],
  preferredWindow: { width: 400, height: 780 },
  status: 'live',
  integration: { kind: 'internal' },
  icon: '🪐',
} satisfies GameManifest
