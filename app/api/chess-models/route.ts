import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { chessModelSubmissionSchema } from '@/lib/chess-models/contracts'
import { inspectHuggingFaceRevision } from '@/lib/chess-models/huggingface'
import { assertSubmissionAllowed, createSubmission, listPublicModels, recordAutomatedInspection } from '@/lib/chess-models/repository'
import { createQuarantineUpload, modelStorageConfigured } from '@/lib/chess-models/storage'

export async function GET() {
  try {
    return NextResponse.json({ models: await listPublicModels(), capabilities: { directUpload: modelStorageConfigured(), huggingFaceImport: true } })
  } catch (error) {
    console.error('[chess-models] list failed', error)
    return NextResponse.json({ error: 'Model registry is unavailable' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const parsed = chessModelSubmissionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid model submission', issues: parsed.error.issues }, { status: 400 })
  if (parsed.data.source === 'direct' && !modelStorageConfigured()) {
    return NextResponse.json({ error: 'Direct model upload is not configured; use Hugging Face submission' }, { status: 503 })
  }

  try {
    let inspection: Awaited<ReturnType<typeof inspectHuggingFaceRevision>> | undefined
    if (parsed.data.source === 'huggingface') inspection = await inspectHuggingFaceRevision(parsed.data.repoId, parsed.data.revision)
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
    const salt = process.env.CHESS_MODEL_ABUSE_SALT
    const sourceIpHash = forwarded && salt ? createHash('sha256').update(`${salt}:${forwarded}`).digest('hex') : undefined
    await assertSubmissionAllowed(sourceIpHash)
    const created = await createSubmission(parsed.data, sourceIpHash)
    if (inspection) await recordAutomatedInspection(created.revisionId, inspection)
    const upload = parsed.data.source === 'direct'
      ? {
          url: await createQuarantineUpload({ objectKey: `${created.revisionId}/${parsed.data.fileName}`, contentLength: parsed.data.sizeBytes, sha256: parsed.data.sha256 }),
          method: 'PUT' as const,
          expiresInSeconds: 900,
          requiredHeaders: { 'content-type': 'application/octet-stream', 'x-amz-checksum-sha256': Buffer.from(parsed.data.sha256, 'hex').toString('base64') },
        }
      : undefined
    return NextResponse.json({
      submission: { receipt: created.receipt, state: inspection ? 'pending_review' : 'pending_scan', modelId: created.modelId, revisionId: created.revisionId },
      inspection: inspection ? { files: inspection.files.length, totalBytes: inspection.totalBytes, sourceRef: inspection.sourceRef } : undefined,
      upload,
    }, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Submission failed'
    const conflict = /duplicate key|unique constraint/i.test(message)
    const limited = message.includes('limit reached')
    const unavailable = message.includes('abuse protection')
    return NextResponse.json({ error: conflict ? 'That model name is already registered' : message }, { status: conflict ? 409 : limited ? 429 : unavailable ? 503 : 400 })
  }
}
