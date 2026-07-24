import { z } from 'zod'

export const PIP_MODEL = 'xiaomi/mimo-v2.5'
export const PIP_MAX_OUTPUT_TOKENS = 320

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(2_000),
}).strict()

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(12),
}).strict().superRefine(({ messages }, context) => {
  if (messages.at(-1)?.role !== 'user') {
    context.addIssue({ code: 'custom', path: ['messages'], message: 'Last message must be from the user' })
  }
})

export type PipChatMessage = z.infer<typeof messageSchema>

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
    keywords: ['consensus', 'radar', 'clue', 'team', 'room', 'multiplayer'],
    content: `Consensus Radar (games/consensus-radar): 4–20 players, about 15–25 minutes. A clue-giver sees a secret target on a two-sided spectrum and gives one clue without numbers or directions. Teammates place markers; closeness to the target earns points. Create or join a six-character room, split into two teams, assign exactly one clue-giver per team, then alternate turns. Server rules are in games/consensus-radar/server.ts and client UI is in games/consensus-radar/client/ConsensusRadarGame.tsx.`,
  },
  {
    keywords: ['minefield', 'mine', 'minesweeper', 'flag', 'logic'],
    content: `Minefield (games/minefield): reveal covered squares with left-click. A number is the count of mines touching that square. Right-click a covered square to flag it. The first reveal is always safe. Clear every non-mine square to win. Beginner is 9×9/10 mines, intermediate 16×16/40, expert 30×16/99. Rules are in games/minefield/model.ts and UI is in games/minefield/client/MinefieldGame.tsx.`,
  },
  {
    keywords: ['pinball', 'orbit', 'flipper', 'ball', 'arcade'],
    content: `Orbit Pinball (games/orbit-pinball): press Space or Launch, use Left/Right arrows or on-screen flipper buttons, hit glowing bumpers for points, and keep three balls out of the drain. Physics and scoring are in games/orbit-pinball/model.ts; canvas rendering and controls are in games/orbit-pinball/client/OrbitPinballGame.tsx. The table art and game code are original.`,
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

export function parsePipChatRequest(value: unknown): { messages: PipChatMessage[] } {
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
      {
        role: 'system' as const,
        content: `You are Pip, the cheerful paperclip guide inside Analytics Games. Be concise, playful, and genuinely useful. Answer game rules and repository questions from the supplied knowledge. Never invent files, features, scores, or rules. If the knowledge does not support an answer, say so and point the user to the Developer Guide. Do not claim to be Microsoft Clippy. Keep responses under 140 words.\n\nKNOWLEDGE BASE:\n${knowledge}`,
      },
      ...messages,
    ],
    user: 'pip-desktop-chat',
    metadata: { app: 'analytics-games', origin: siteUrl },
  }
}
