import type { GameManifest } from '@/lib/engine/types'

export const consensusRadarManifest = {
  id: 'consensus-radar',
  version: 1,
  title: 'Consensus Radar',
  eyebrow: 'Team calibration',
  description: 'One spectrum, one clue, many instincts. Find where your team converges.',
  accent: '#00f5a0',
  accentSoft: 'rgba(0, 245, 160, 0.12)',
  minPlayers: 4,
  maxPlayers: 20,
  estimatedMinutes: '15–25 min',
  tags: ['teams', 'estimation', 'facilitation'],
  instructions: [
    { title: 'See the signal', detail: 'A clue-giver gets a secret target on a two-sided scale.' },
    { title: 'Give one clue', detail: 'They guide their team without saying a number or direction.' },
    { title: 'Calibrate together', detail: 'Teammates place markers. Their average distance earns points.' },
  ],
  status: 'live',
  integration: { kind: 'internal' },
  icon: '📡',
} satisfies GameManifest
