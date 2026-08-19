import type { GameManifest } from '@/lib/engine/types'

export const orbitPinballManifest = {
  id: 'orbit-pinball',
  version: 4,
  title: 'Neon Forge Pinball',
  eyebrow: 'Original reactor table',
  description: 'Charge the reactor, complete shot objectives, lock balls, and chase escalating jackpots in an original full-featured pinball table.',
  accent: '#24e7ff',
  accentSoft: 'linear-gradient(135deg, #07182b, #a65cff)',
  minPlayers: 1,
  maxPlayers: 1,
  estimatedMinutes: '2–10 min',
  tags: ['solo', 'arcade', 'classic', 'physics'],
  instructions: [
    { title: 'Launch', detail: 'Hold Space to charge the plunger, release to launch the ball.' },
    { title: 'Flippers', detail: 'Use Left/Z and Right/Slash, or the dedicated touch controls.' },
    { title: 'Build the reactor', detail: 'Complete F·O·R·G·E and lock twice for multiball; use N·E·O·N lanes, turbine, ramp, scoop, and core to build multipliers, modes, and jackpots.' },
  ],
  preferredWindow: { width: 400, height: 780 },
  status: 'live',
  integration: { kind: 'internal' },
  icon: '⚡',
} satisfies GameManifest
