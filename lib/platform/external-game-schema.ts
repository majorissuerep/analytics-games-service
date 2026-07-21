import { z } from 'zod'
import { GAME_BRIDGE_VERSION, type GameManifest } from '@/lib/engine/types'

const instructionSchema = z.object({
  title: z.string().trim().min(1).max(80),
  detail: z.string().trim().min(1).max(240),
}).strict()

export const externalGameManifestSchema = z.object({
  // Anchored, max-80 input; scanner cannot infer Zod's preceding bound.
  // eslint-disable-next-line security/detect-unsafe-regex
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  version: z.number().int().positive(),
  title: z.string().trim().min(1).max(80),
  eyebrow: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(320),
  accent: z.string().trim().min(1).max(40),
  accentSoft: z.string().trim().min(1).max(80),
  minPlayers: z.number().int().min(1).max(1_000),
  maxPlayers: z.number().int().min(1).max(1_000),
  estimatedMinutes: z.string().trim().min(1).max(40),
  tags: z.array(z.string().trim().min(1).max(32)).max(12),
  instructions: z.array(instructionSchema).max(12),
  status: z.enum(['live', 'beta', 'coming-soon']),
  icon: z.string().trim().min(1).max(12).optional(),
  integration: z.object({
    kind: z.literal('external'),
    launchUrl: z.url().refine((value) => new URL(value).protocol === 'https:', 'launchUrl must use HTTPS'),
    origin: z.url().transform((value) => new URL(value).origin),
    bridgeVersion: z.literal(GAME_BRIDGE_VERSION),
    openMode: z.enum(['embedded', 'redirect']).optional(),
  }).strict(),
}).strict().superRefine((manifest, context) => {
  if (manifest.minPlayers > manifest.maxPlayers) {
    context.addIssue({
      code: 'custom',
      path: ['maxPlayers'],
      message: 'maxPlayers must be greater than or equal to minPlayers',
    })
  }
  if (new URL(manifest.integration.launchUrl).origin !== manifest.integration.origin) {
    context.addIssue({
      code: 'custom',
      path: ['integration', 'origin'],
      message: 'origin must match launchUrl origin',
    })
  }
})

export function parseExternalGameManifest(value: unknown): GameManifest {
  return externalGameManifestSchema.parse(value) as GameManifest
}
