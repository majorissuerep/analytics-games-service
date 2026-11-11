import { Chess } from 'chess.js'
import { NextResponse } from 'next/server'
import { chessModelMoveRequestSchema } from '@/lib/chess-models/contracts'
import { defaultStyledRepertoireForModelColor, BUILTIN_STYLED_OPENING } from '@/lib/chess-models/styled'
import { requestStyledMove } from '@/lib/chess-models/styled-runtime'

import { analyseWithEngine, isUciEngine } from '@/lib/engine/uci-runtime'
import { engineResponse } from '@/lib/engine/progress-response'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request, context: { params: Promise<{ revisionId: string }> }) {
  const parsed = chessModelMoveRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid inference request' }, { status: 400 })
  const { revisionId } = await context.params

  try {
    let chess: Chess
    try { chess = new Chess(parsed.data.fen) } catch { return NextResponse.json({ error: 'Invalid FEN' }, { status: 400 }) }
    const authoritative = chess.moves({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion ?? ''}`).sort()
    const supplied = [...new Set(parsed.data.legalMoves)].sort()
    if (authoritative.length !== supplied.length || authoritative.some((move, index) => move !== supplied[index])) {
      return NextResponse.json({ error: 'Legal move set does not match FEN' }, { status: 400 })
    }

    if (parsed.data.history.length) {
      const replay = new Chess()
      for (const move of parsed.data.history) replay.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] })
      if (replay.fen() !== chess.fen()) return NextResponse.json({ error: 'History does not match FEN' }, { status: 400 })
    }
    if (isUciEngine(revisionId)) {
      return await engineResponse(request, async onProgress => {
        const result = await analyseWithEngine(revisionId, {
        fen: chess.fen(), multiPv: 1, moveTimeMs: parsed.data.moveTimeMs,
        skill: parsed.data.skill, history: parsed.data.history,
        onProgress, signal: request.signal,
      })
      if (!supplied.includes(result.bestMove)) throw new Error('Engine returned an illegal move')
        return { move: result.bestMove, revisionId, durationMs: result.durationMs }
      })
    }

    if (revisionId === BUILTIN_STYLED_OPENING) {
      const turn = parsed.data.fen.split(' ')[1]
      const repertoireId = parsed.data.repertoireId ?? defaultStyledRepertoireForModelColor(turn === 'w' ? 'w' : 'b')
      return await engineResponse(request, async onProgress => {
        const result = await requestStyledMove({
        fen: parsed.data.fen,
        history: parsed.data.history,
        repertoireId,
        legalMoves: supplied,
        moveTimeMs: parsed.data.moveTimeMs,
        onProgress, signal: request.signal,
      })
        return { move: result.move, revisionId, repertoireId, durationMs: result.durationMs }
      })
    }

    return NextResponse.json({ error: 'This model has no Vercel runtime. Cluster hosting is retired.' }, { status: 503 })
  } catch (error) {
    console.error('[chess-model-inference] failed', error)
    return NextResponse.json({ error: 'Chess engine could not complete this move. Retry or choose another engine.' }, { status: 502 })
  }
}
