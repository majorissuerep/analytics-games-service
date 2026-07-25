import { NextResponse } from 'next/server'
import { adminModelPatchSchema } from '@/lib/chess-models/contracts'
import { isAdminRequest, patchModel } from '@/lib/chess-models/repository'

export async function PATCH(request: Request, context: { params: Promise<{ modelId: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: 'Admin authorization required' }, { status: 401 })
  const body = adminModelPatchSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'Invalid model update', issues: body.error.issues }, { status: 400 })
  const { modelId } = await context.params
  const model = await patchModel(modelId, body.data)
  return model ? NextResponse.json({ model }) : NextResponse.json({ error: 'Model not found' }, { status: 404 })
}
