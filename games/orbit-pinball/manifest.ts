import type { GameManifest } from '@/lib/engine/types'

export const orbitPinballManifest = {
  id: 'orbit-pinball',
  version: 3,
  title: 'Classic Pinball',
  eyebrow: 'Arcade classic',
  description:
    'The classic lrusso pinball table with Box2D physics, wrapped in a first-class cabinet: instant mute, a scaled letterboxed table, and a branded loader — the upstream game itself stays untouched.',
  accent: '#ffb000',
  accentSoft: 'linear-gradient(135deg, #21125e, #f05a38)',
  minPlayers: 1,
  maxPlayers: 1,
  estimatedMinutes: '2–8 min',
  tags: ['solo', 'arcade', 'classic'],
  instructions: [
    { title: 'Launch', detail: 'Open the game and press the large play button on the arcade menu.' },
    { title: 'Control', detail: 'Use A / D or the left and right sides of the table for the flippers; hold Space to charge the plunger.' },
    { title: 'Score', detail: 'Hit bumpers, collect stars, and keep the ball above the drain. Toggle SFX from the cabinet bar.' },
    { title: 'Exit', detail: 'Use Exit in the cabinet bar (or the window close button) to return to the desktop.' },
  ],
  preferredWindow: { width: 430, height: 760 },
  status: 'live',
  integration: { kind: 'internal', launchPath: '/vendor/pinball/cabinet.html' },
  icon: '🪐',
} satisfies GameManifest
