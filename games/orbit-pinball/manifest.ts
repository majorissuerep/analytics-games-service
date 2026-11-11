import type { GameManifest } from '@/lib/engine/types'

export const orbitPinballManifest = {
  id: 'orbit-pinball',
  version: 4,
  title: 'Space Cadet Pinball',
  eyebrow: 'The XP-era classic',
  description: 'The faithful Space Cadet engine, compiled to WebAssembly. Play with freely licensed Open Cadet artwork, or load original XP game files locally for the original look and sounds.',
  accent: '#b12d75',
  accentSoft: 'linear-gradient(135deg, #ddd7f4, #fce5f2)',
  minPlayers: 1,
  maxPlayers: 1,
  estimatedMinutes: '2–15 min',
  tags: ['solo', 'classic', 'Space Cadet'],
  instructions: [
    { title: 'Start', detail: 'Press New game or F2. Free-play uses the Space Cadet engine with CC0 replacement art.' },
    { title: 'Control', detail: 'Z and / control the flippers. Hold Space to charge, then release to launch. F3 pauses; touch controls are available.' },
    { title: 'Original look', detail: 'Use original XP files to load your own PINBALL.DAT and sounds locally. Files stay in your browser and are never uploaded.' },
  ],
  preferredWindow: { width: 920, height: 740 },
  status: 'live',
  integration: { kind: 'internal', launchPath: '/vendor/pinball/cabinet.html' },
  icon: '🪐',
} satisfies GameManifest
