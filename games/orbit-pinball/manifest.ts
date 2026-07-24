import type { GameManifest } from '@/lib/engine/types'

export const orbitPinballManifest = {
  id: 'orbit-pinball',
  version: 2,
  title: 'Classic Pinball',
  eyebrow: 'Arcade classic',
  description: 'A complete upstream browser pinball game with Box2D physics, scoring, audio, and a full table.',
  accent: '#ffb000',
  accentSoft: 'linear-gradient(135deg, #21125e, #f05a38)',
  minPlayers: 1,
  maxPlayers: 1,
  estimatedMinutes: '2–8 min',
  tags: ['solo', 'arcade', 'classic'],
  instructions: [
    { title: 'Start', detail: 'Press the large play button to begin a full table.' },
    { title: 'Control', detail: 'Use the left and right sides of the table for the flippers.' },
    { title: 'Score', detail: 'Hit bumpers, collect stars, and keep the ball above the drain.' },
  ],
  preferredWindow: { width: 430, height: 760 },
  status: 'live',
  integration: { kind: 'internal', launchPath: '/vendor/pinball/PinballGame.htm' },
  icon: '🪐',
} satisfies GameManifest
