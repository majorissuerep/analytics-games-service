import { NextResponse } from 'next/server'
import { isAdminRequest, listAdminModels } from '@/lib/chess-models/repository'

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: 'Admin authorization required' }, { status: 401 })
  return NextResponse.json({ models: await listAdminModels() })
}
