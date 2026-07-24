import type { GameManifest } from '@/lib/engine/types'

export const orbitPinballManifest = {
  id: 'orbit-pinball',
  version: 1,
  title: 'Orbit Pinball',
  eyebrow: 'Arcade classic',
  description: 'Launch into an original neon table, light the bumpers, and defend the drain.',
  accent: '#ffb000',
  accentSoft: 'linear-gradient(135deg, #21125e, #f05a38)',
  minPlayers: 1,
  maxPlayers: 1,
  estimatedMinutes: '2–8 min',
  tags: ['solo', 'arcade', 'classic'],
  instructions: [
    { title: 'Launch', detail: 'Press Space or Launch to send the ball into orbit.' },
    { title: 'Flip', detail: 'Use left/right arrows or the on-screen flippers.' },
    { title: 'Score', detail: 'Hit bumpers and keep three balls out of the drain.' },
  ],
  status: 'live',
  integration: { kind: 'internal' },
  icon: '🪐',
} satisfies GameManifest
