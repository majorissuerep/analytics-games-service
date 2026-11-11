import type { GameManifest } from '@/lib/engine/types'

export const orbitPinballManifest = {
  id: 'orbit-pinball',
  version: 5,
  title: 'Space Cadet Pinball',
  eyebrow: 'The XP-era classic',
  description: 'The faithful Space Cadet engine with original Aster table art. Ready to play: Space launches, left and right arrows work the flippers, and your score stays in view.',
  accent: '#b12d75',
  accentSoft: 'linear-gradient(135deg, #ddd7f4, #fce5f2)',
  minPlayers: 1,
  maxPlayers: 1,
  estimatedMinutes: '2–15 min',
  tags: ['solo', 'classic', 'Space Cadet'],
  instructions: [
    { title: 'Launch', detail: 'A game is ready when the table opens. Hold Space to charge, then release to launch.' },
    { title: 'Flippers', detail: 'Use the left and right arrows. On touchscreens, use the three controls below the table.' },
    { title: 'Play', detail: 'Your live score and ball appear above the table. Pause, sound and restart are always within reach.' },
  ],
  preferredWindow: { width: 920, height: 740 },
  status: 'live',
  integration: { kind: 'internal', launchPath: '/vendor/pinball/cabinet.html' },
  icon: '🪐',
} satisfies GameManifest
