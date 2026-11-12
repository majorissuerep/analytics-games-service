import { NextResponse } from 'next/server'

/** Public source/native identity for verifying the actual deployed build. */
export function GET() {
  return NextResponse.json({
    schemaVersion: 1,
    commit: process.env.NEXT_PUBLIC_EXPERIENCE_COMMIT || null,
    tree: process.env.NEXT_PUBLIC_EXPERIENCE_TREE || null,
    nativeAssets: JSON.parse(process.env.NEXT_PUBLIC_EXPERIENCE_NATIVE || '{}') as Record<string, string>,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
