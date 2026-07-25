import { NextResponse } from 'next/server'
import { getSubmissionStatus } from '@/lib/chess-models/repository'

export async function GET(_request: Request, context: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = await context.params
  if (!/^[A-Za-z0-9_-]{43}$/.test(receiptId)) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  const status = await getSubmissionStatus(receiptId)
  if (!status) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  return NextResponse.json({
    submission: {
      displayName: status.display_name,
      state: status.state,
      reason: status.rejection_reason,
      updatedAt: status.updated_at,
    },
  })
}
