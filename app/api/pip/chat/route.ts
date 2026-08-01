import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { buildOpenRouterRequest, parsePipChatRequest, PIP_MODEL, type PipChatMessage } from '@/lib/pip/chat'
import { checkContentSafety } from '@/lib/pip/guardrail'
import { hashUserKey, loadPipSession, pipMemoryEnabled, savePipSession } from '@/lib/pip/session-store'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 12
const REQUEST_TIMEOUT_MS = 20_000

const BLOCKED_REPLY = 'Whoops — that one tripped my office-safety filter, so I have to file it away. Ask me about the games on the desktop instead!'

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

function blockedResponse() {
  return NextResponse.json(
    { message: BLOCKED_REPLY, model: PIP_MODEL, blocked: true },
    { headers: { 'Cache-Control': 'no-store' } },
  )
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
    const { userKey, message } = parsePipChatRequest(await request.json())

    // ── Guardrail 1: scan user input (fail-closed) ─────────────────────────
    if (await checkContentSafety(message, apiKey) === 'unsafe') {
      return blockedResponse()
    }

    // ── Assemble conversation from per-user server-side memory ─────────────
    const memory = pipMemoryEnabled()
    const keyHash = hashUserKey(userKey)
    let history: PipChatMessage[] = []
    if (memory) {
      try {
        history = await loadPipSession(keyHash)
      } catch {
        history = [] // memory outage must not take the chat down
      }
    }
    const conversation: PipChatMessage[] = [...history, { role: 'user', content: message }]

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
        body: JSON.stringify(buildOpenRouterRequest(conversation, request.nextUrl.origin)),
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
    const answer = result.choices[0].message.content.slice(0, 4_000)

    // ── Guardrail 2: scan model output before serving (fail-closed) ────────
    if (await checkContentSafety(answer, apiKey) === 'unsafe') {
      return blockedResponse()
    }

    // ── Persist the turn to the user session (best effort) ─────────────────
    if (memory) {
      try {
        await savePipSession(keyHash, [...conversation, { role: 'assistant', content: answer }])
      } catch {
        // memory outage must not take the chat down
      }
    }

    return NextResponse.json(
      { message: answer, model: PIP_MODEL },
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
