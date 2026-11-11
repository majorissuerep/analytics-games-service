import type { GameManifest } from '@/lib/engine/types'

/** Discovery only. No server rules, client game, media credentials, or room routes. */
export const mafiaManifest = {
  id: 'mafia',
  version: 1,
  title: 'Mafia Online',
  eyebrow: 'Coming soon',
  description: 'A private table for deduction, bluffing, and debate. Online Mafia with optional voice and video is planned for up to 20 people, including the host.',
  accent: '#b12d75',
  accentSoft: 'linear-gradient(145deg, #fce5f2, #ddd7f4)',
  minPlayers: 6,
  maxPlayers: 20,
  estimatedMinutes: '30–60 min planned',
  tags: ['coming soon', 'social deduction', 'video planned'],
  instructions: [
    { title: 'Gather', detail: 'Planned: invite friends to a private room with a host and a ready check.' },
    { title: 'Read the room', detail: 'Planned: discuss by voice, optionally enable a camera, and keep your role secret.' },
    { title: 'Choose carefully', detail: 'Planned: vote by day and use your role’s private actions at night.' },
  ],
  preferredWindow: { width: 780, height: 640 },
  status: 'coming-soon',
  integration: { kind: 'internal' },
  icon: '/icons/mafia.svg',
} satisfies GameManifest
