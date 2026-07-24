import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { buildOpenRouterRequest, parsePipChatRequest, PIP_MODEL } from '@/lib/pip/chat'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 12
const REQUEST_TIMEOUT_MS = 20_000

const openRouterResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string().min(1) }),
  })).min(1),
}).passthrough()

interface RateBucket {
  count: number
  resetAt: number
}

const rateBuckets = new Map<string, RateBucket>()

function clientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'local'
}

function consumeRateLimit(key: string, now = Date.now()) {
  const current = rateBuckets.get(key)
  if (!current || now >= current.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) return false
  current.count += 1
  return true
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Pip chat is not configured' }, { status: 503 })
  }
  if (!consumeRateLimit(clientKey(request))) {
    return NextResponse.json({ error: 'Pip needs a tiny breather. Try again shortly.' }, { status: 429 })
  }

  try {
    const { messages } = parsePipChatRequest(await request.json())
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': request.nextUrl.origin,
          'X-Title': 'Analytics Games Pip',
        },
        body: JSON.stringify(buildOpenRouterRequest(messages, request.nextUrl.origin)),
        cache: 'no-store',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      console.error(`[pip-chat] OpenRouter request failed with status ${response.status}`)
      return NextResponse.json({ error: 'Pip lost the signal. Please try again.' }, { status: 502 })
    }

    const result = openRouterResponseSchema.parse(await response.json())
    return NextResponse.json(
      { message: result.choices[0].message.content.slice(0, 4_000), model: PIP_MODEL },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid conversation' }, { status: 400 })
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Pip took too long to answer. Try again.' }, { status: 504 })
    }
    console.error('[pip-chat] Unexpected provider response')
    return NextResponse.json({ error: 'Pip hit an unexpected snag.' }, { status: 502 })
  }
}
