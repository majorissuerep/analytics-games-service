import { z } from 'zod'
import { buildPipSystemPrompt } from './persona'

export const PIP_MODEL = 'deepseek/deepseek-v4-flash'
export const PIP_MAX_OUTPUT_TOKENS = 320

const requestSchema = z.object({
  userKey: z.string().trim().min(8).max(100).regex(
    /^[A-Za-z0-9-]+$/,
    'userKey must be an opaque alphanumeric token',
  ),
  message: z.string().trim().min(1).max(2_000),
}).strict()

export interface PipChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface PipChatRequest {
  userKey: string
  message: string
}

interface KnowledgeEntry {
  keywords: readonly string[]
  content: string
}

const PLATFORM_OVERVIEW = `Platform overview (repository source of truth):
- Analytics Games is a Next.js 16 / React 19 / TypeScript monorepo styled as the original Millennium Desktop.
- Internal games are registered in games/catalog.ts and rendered through games/client-registry.tsx.
- Desktop windows and plugin slots live in components/desktop/DesktopShell.tsx; window state uses Zustand in components/desktop/store.ts.
- Multiplayer APIs live under app/api/rooms; PostgreSQL state and server-authoritative rules prevent clients from replacing room state.
- Pip is the original CSS-drawn paperclip assistant in plugins/paperclip-assistant. It is not Microsoft Clippy and uses no Microsoft art or audio.`

const KNOWLEDGE: readonly KnowledgeEntry[] = [
  {
    keywords: ['chess', 'checkmate', 'bot', 'castle', 'room', 'pass'],
    content: `Chess (games/chess) supports pass-and-play, Stockfish 18 WASM opponents at five difficulties, and two-player online rooms with optional passwords. Players can choose White, Black, or Random. The polished board supports click or drag moves, legal-square highlights, explicit promotion choice, move history, and responsive layouts. Rules use chess.js and online moves are server-authoritative.`,
  },
  {
    keywords: ['consensus', 'radar', 'clue', 'team', 'room', 'multiplayer'],
    content: `Consensus Radar (games/consensus-radar): 4–20 players, about 15–25 minutes. A clue-giver sees a secret target on a two-sided spectrum and gives one clue without numbers or directions. Teammates place markers; closeness to the target earns points. Create or join a six-character room, split into two teams, assign exactly one clue-giver per team, then alternate turns. Server rules are in games/consensus-radar/server.ts and client UI is in games/consensus-radar/client/ConsensusRadarGame.tsx.`,
  },
  {
    keywords: ['minefield', 'mine', 'minesweeper', 'flag', 'logic'],
    content: `Minefield (games/minefield): reveal covered squares with left-click. A number is the count of mines touching that square. Right-click a covered square to flag it. The first reveal is always safe. Clear every non-mine square to win. Beginner is 9×9/10 mines, intermediate 16×16/40, expert 30×16/99. Rules are in games/minefield/model.ts and UI is in games/minefield/client/MinefieldGame.tsx.`,
  },
  {
    keywords: ['pinball', 'flipper', 'ball', 'arcade'],
    content: `Neon Forge Pinball (games/orbit-pinball) is an original reactor-themed table. Planck.js provides fixed-step collision detection, CCD, and flipper joints; the table geometry, rules, rendering, synthesized opt-in audio, and visual design are repository-authored. Hold Space to charge and release the plunger. Use Left/Z and Right/Slash for flippers. Complete F·O·R·G·E to light lock, lock two balls for three-ball multiball, and shoot the core for escalating jackpots. N·E·O·N lanes raise the playfield multiplier, the turbine builds a ramp cashout, and the scoop starts Reactor Rush. Nudge with N, but three quick nudges tilt. Physics integration is in games/orbit-pinball/lib/physics.ts, table geometry in table.ts, rules in model.ts, and rendering/UI in client/.`,
  },
  {
    keywords: ['paintbox', 'paint', 'draw', 'canvas', 'brush', 'png', 'eraser'],
    content: `Paintbox (games/paintbox): select a color, brush or eraser, adjust size, then drag on the canvas with mouse, pen, or touch. Undo restores recent actions, New clears after preserving an undo snapshot, and Save PNG downloads the drawing. UI and browser-local canvas state are in games/paintbox/client/PaintboxGame.tsx.`,
  },
  {
    keywords: ['plugin', 'pip', 'assistant', 'sticky', 'shuffle', 'counter'],
    content: `Desktop plugins are build-time React packages registered in plugins/registry.ts using typed slots from packages/plugin-sdk. Bundled plugins are Pip Assistant (overlay), Sticky Note (local note), Game Shuffle (Start menu), and Game Counter (tray). Enable or disable them in the desktop Plugin Manager.`,
  },
  {
    keywords: ['code', 'repo', 'repository', 'architecture', 'api', 'developer', 'build'],
    content: `Repository map: app/ contains routes and APIs; components/desktop contains the shell and frames; games/ contains isolated game workspaces; plugins/ contains desktop extensions; packages/ contains bridge/plugin SDKs; lib/engine contains shared room infrastructure; db/migrations contains PostgreSQL DDL; tests/e2e/platform.spec.ts contains production-browser acceptance. Use npm run check for lint, unit tests, type checks, workspace checks, and build.`,
  },
]

export function parsePipChatRequest(value: unknown): PipChatRequest {
  return requestSchema.parse(value)
}

export function selectPipKnowledge(question: string): string {
  const normalized = question.toLowerCase()
  const matches = KNOWLEDGE
    .filter((entry) => entry.keywords.some((keyword) => normalized.includes(keyword)))
    .slice(0, 3)
  return [PLATFORM_OVERVIEW, ...matches.map((entry) => entry.content)].join('\n\n')
}

export function buildOpenRouterRequest(messages: PipChatMessage[], siteUrl: string) {
  const latestQuestion = messages.at(-1)?.content ?? ''
  const knowledge = selectPipKnowledge(latestQuestion)
  return {
    model: PIP_MODEL,
    provider: { zdr: true },
    max_tokens: PIP_MAX_OUTPUT_TOKENS,
    temperature: 0.65,
    messages: [
      { role: 'system' as const, content: buildPipSystemPrompt(knowledge) },
      ...messages,
    ],
    user: 'pip-desktop-chat',
    metadata: { app: 'analytics-games', origin: siteUrl },
  }
}
