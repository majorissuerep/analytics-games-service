import os from 'node:os'
import { NextResponse } from 'next/server'
import { Chess } from 'chess.js'
import { z } from 'zod'
import { analyseWithReckless, recklessAvailable } from '@/lib/engine/reckless'
import { presentAnalysis } from '@/lib/engine/reckless-presentation'

const analyseSchema = z.object({
  fen: z.string().trim().min(10).max(100),
  multiPv: z.coerce.number().int().min(1).max(20).default(20),
  moveTimeMs: z.coerce.number().int().min(100).max(10_000).default(600),
})

export async function POST(request: Request) {
  const parsed = analyseSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid analyse request' }, { status: 400 })
  let chess: Chess
  try {
    chess = new Chess(parsed.data.fen)
  } catch {
    return NextResponse.json({ error: 'Invalid FEN' }, { status: 400 })
  }
  if (chess.isGameOver()) return NextResponse.json({ error: 'The game is already over' }, { status: 400 })
  const legalUci = new Set(chess.moves({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ''}`))
  if (legalUci.size === 0) return NextResponse.json({ error: 'No legal moves in this position' }, { status: 400 })
  if (!recklessAvailable()) return NextResponse.json({ error: 'Reckless engine binary is missing on the server' }, { status: 503 })
  const threads = Number(process.env.RECKLESS_THREADS) || Math.min(8, os.cpus().length)
  const hashMb = Number(process.env.RECKLESS_HASH_MB) || 256
  try {
    const analysis = await analyseWithReckless({
      fen: chess.fen(),
      multiPv: parsed.data.multiPv,
      moveTimeMs: parsed.data.moveTimeMs,
      threads,
      hashMb,
    })
    return NextResponse.json({
      fen: chess.fen(),
      turn: chess.turn(),
      analysis: presentAnalysis(chess.fen(), chess.turn(), analysis, legalUci),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reckless analysis failed' },
      { status: 502 },
    )
  }
}
