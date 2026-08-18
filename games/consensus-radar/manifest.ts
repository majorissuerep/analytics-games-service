import type { GameManifest } from '@/lib/engine/types'

export const consensusRadarManifest = {
  id: 'consensus-radar',
  version: 2,
  title: 'Consensus Radar',
  eyebrow: 'Team calibration',
  description: 'One spectrum, one clue, many instincts. Find where your team converges while rivals bet on your miss.',
  accent: '#00f5a0',
  accentSoft: 'rgba(0, 245, 160, 0.12)',
  minPlayers: 4,
  maxPlayers: 20,
  estimatedMinutes: '15–25 min',
  tags: ['teams', 'estimation', 'facilitation'],
  instructions: [
    { title: 'See the signal', detail: 'A rotating clue-giver gets a secret target on a two-sided scale.' },
    { title: 'Give one clue', detail: 'They guide their team without saying a number — digits are banned.' },
    { title: 'Calibrate together', detail: 'Teammates average their markers for points; rival teams bet on the side.' },
  ],
  status: 'live',
  integration: { kind: 'internal' },
  icon: '📡',
} satisfies GameManifest
