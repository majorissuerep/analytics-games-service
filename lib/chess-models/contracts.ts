import { z } from 'zod'

export const CHESS_MODEL_RUNTIMES = ['onnx-policy-v1', 'hf-transformers-chess-v1'] as const
export const CHESS_MODEL_STATES = [
  'pending_scan', 'pending_review', 'scan_failed', 'approved', 'rejected',
  'deploying', 'ready', 'deployment_failed', 'disabled', 'archived',
] as const

const common = {
  name: z.string().regex(/^[a-z][a-z0-9-]{2,39}$/),
  displayName: z.string().trim().min(3).max(80),
  description: z.string().trim().max(1000).default(''),
  runtime: z.enum(CHESS_MODEL_RUNTIMES),
  license: z.string().trim().min(2).max(80),
  submitterContact: z.string().email().max(254).optional(),
}

export const directSubmissionSchema = z.object({
  source: z.literal('direct'),
  ...common,
  sizeBytes: z.number().int().min(1).max(1_073_741_824),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  fileName: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\.(zip|tar\.zst)$/),
}).strict()

export const huggingFaceSubmissionSchema = z.object({
  source: z.literal('huggingface'),
  ...common,
  repoId: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  revision: z.string().regex(/^[a-f0-9]{40}$/),
}).strict()

export const chessModelSubmissionSchema = z.discriminatedUnion('source', [
  directSubmissionSchema,
  huggingFaceSubmissionSchema,
])

export const adminModelPatchSchema = z.object({
  displayName: z.string().trim().min(3).max(80).optional(),
  description: z.string().trim().max(1000).optional(),
  disabled: z.boolean().optional(),
  archived: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0, { message: 'At least one change is required' })

export const adminDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().max(1000).optional(),
}).strict().refine(value => value.decision !== 'reject' || Boolean(value.reason), {
  message: 'A rejection reason is required',
})

export const chessModelMoveRequestSchema = z.object({
  fen: z.string().min(10).max(120),
  legalMoves: z.array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/)).min(1).max(256),
  moveTimeMs: z.number().int().min(50).max(5000),
}).strict()

export const createModelMatchSchema = z.object({
  whiteRevisionId: z.string().min(3).max(100),
  blackRevisionId: z.string().min(3).max(100),
}).strict()

export const modelMatchMoveSchema = z.object({
  uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
  durationMs: z.number().int().min(0).max(3000),
  expectedPly: z.number().int().min(0).max(1000),
}).strict()

export const modelMatchPauseSchema = z.object({ paused: z.boolean() }).strict()

export type ChessModelSubmission = z.infer<typeof chessModelSubmissionSchema>

export type PublicChessModel = {
  id: string
  slug: string
  displayName: string
  description: string
  runtimeId: string
  revisionId: string
  sourceType: string
  license: string
  status: 'ready'
}

export const BUILTIN_STOCKFISH: PublicChessModel = {
  id: 'builtin-stockfish-18',
  slug: 'stockfish-18',
  displayName: 'Stockfish 18',
  description: 'Built-in Stockfish 18 lite WASM engine with five difficulty levels.',
  runtimeId: 'builtin-stockfish-18',
  revisionId: 'builtin-stockfish-18',
  sourceType: 'builtin',
  license: 'GPL-3.0',
  status: 'ready',
}
