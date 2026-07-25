import { Chess } from 'chess.js'
import { NextResponse } from 'next/server'
import { chessModelMoveRequestSchema } from '@/lib/chess-models/contracts'
import { getReadyModelDeployment } from '@/lib/chess-models/repository'

export async function POST(request: Request, context: { params: Promise<{ revisionId: string }> }) {
  const parsed = chessModelMoveRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid inference request' }, { status: 400 })
  const { revisionId } = await context.params
  const deployment = await getReadyModelDeployment(revisionId)
  if (!deployment) return NextResponse.json({ error: 'Model revision is not ready' }, { status: 404 })

  try {
    const chess = new Chess(parsed.data.fen)
    const authoritative = chess.moves({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion ?? ''}`).sort()
    const supplied = [...new Set(parsed.data.legalMoves)].sort()
    if (authoritative.length !== supplied.length || authoritative.some((move, index) => move !== supplied[index])) {
      return NextResponse.json({ error: 'Legal move set does not match FEN' }, { status: 400 })
    }

    const endpoint = new URL(deployment.endpoint)
    endpoint.pathname = `/v2/models/${encodeURIComponent(deployment.slug)}/versions/${encodeURIComponent(deployment.revision_id)}/infer`
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        inputs: [
          { name: 'fen', shape: [1], datatype: 'BYTES', data: [parsed.data.fen] },
          { name: 'legal_moves', shape: [supplied.length], datatype: 'BYTES', data: supplied },
          { name: 'move_time_ms', shape: [1], datatype: 'INT64', data: [parsed.data.moveTimeMs] },
        ],
      }),
      signal: AbortSignal.timeout(Math.min(parsed.data.moveTimeMs + 750, 5750)),
    })
    if (!upstream.ok) throw new Error(`Runtime returned HTTP ${upstream.status}`)
    const result = await upstream.json() as { outputs?: Array<{ name?: string; data?: unknown[] }> }
    const move = result.outputs?.find(output => output.name === 'move')?.data?.[0]
    if (typeof move !== 'string' || !supplied.includes(move)) throw new Error('Runtime returned an illegal or malformed move')
    return NextResponse.json({ move, revisionId })
  } catch (error) {
    console.error('[chess-model-inference] failed', error)
    return NextResponse.json({ error: 'Custom model failed safely; choose retry or Stockfish' }, { status: 502 })
  }
}
