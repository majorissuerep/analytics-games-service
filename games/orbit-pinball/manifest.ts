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
    { title: 'Control', detail: 'Flip with A / D or the screen edges; hold Space to charge the plunger. Toggle SFX from the cabinet bar.' },
    { title: 'Score', detail: 'Hit bumpers, collect stars, and keep the ball above the drain — then use Exit in the cabinet bar to return.' },
  ],
  preferredWindow: { width: 430, height: 760 },
  status: 'live',
  integration: { kind: 'internal', launchPath: '/vendor/pinball/cabinet.html' },
  icon: '🪐',
} satisfies GameManifest
