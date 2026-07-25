import { NextResponse } from 'next/server'
import { adminDecisionSchema } from '@/lib/chess-models/contracts'
import { decideRevision, isAdminRequest } from '@/lib/chess-models/repository'

export async function POST(request: Request, context: { params: Promise<{ modelId: string; revisionId: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: 'Admin authorization required' }, { status: 401 })
  const body = adminDecisionSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'Invalid review decision', issues: body.error.issues }, { status: 400 })
  const { modelId, revisionId } = await context.params
  const revision = await decideRevision(modelId, revisionId, body.data.decision, body.data.reason)
  return revision
    ? NextResponse.json({ revision })
    : NextResponse.json({ error: 'Revision is not awaiting review' }, { status: 409 })
}
