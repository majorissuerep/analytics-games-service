import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  buildOpenRouterRequest,
  parsePipChatRequest,
  selectPipKnowledge,
  PIP_MODEL,
  type PipChatMessage,
} from '@/lib/pip/chat'
import { buildPipSystemPrompt } from '@/lib/pip/persona'
import { checkContentSafety } from '@/lib/pip/guardrail'
import { hashUserKey, loadPipSession, pipMemoryEnabled, savePipSession } from '@/lib/pip/session-store'
import { chunkAnswer, encodeSse, parseOpenRouterStream, parseSseStream } from '@/lib/pip/stream'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 12
const REQUEST_TIMEOUT_MS = 30_000
const REPLAY_CHUNK_DELAY_MS = 18

const BLOCKED_REPLY = 'Whoops — that one tripped my office-safety filter, so I have to file it away. Ask me about the games on the desktop instead!'

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface TurnResult {
  text: string
  reasoning: string
  model: string
  usage?: Record<string, unknown>
}

/**
 * Drive one turn against the Hermes pip-agent runtime when PIP_AGENT_URL is
 * configured, otherwise against OpenRouter directly (node shim). In both
 * modes, only status/tool events are forwarded live; the answer text and
 * reasoning are buffered so the fail-closed output guardrail can scan them
 * before a single glyph reaches the browser.
 */
async function driveTurn(
  conversation: PipChatMessage[],
  origin: string,
  apiKey: string,
  emit: (event: string, data: Record<string, unknown>) => void,
): Promise<TurnResult> {
  const agentUrl = process.env.PIP_AGENT_URL
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    if (agentUrl) {
      const knowledge = selectPipKnowledge(conversation.at(-1)?.content ?? '')
      const response = await fetch(`${agentUrl.replace(/\/$/, '')}/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: buildPipSystemPrompt(knowledge),
          messages: conversation,
          model: PIP_MODEL,
        }),
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok || !response.body) throw new Error(`pip-agent HTTP ${response.status}`)
      let text = ''
      let reasoning = ''
      let model = PIP_MODEL
      let usage: Record<string, unknown> | undefined
      for await (const { event, data } of parseSseStream(response.body)) {
        if (event === 'delta') text += String(data.text ?? '')
        else if (event === 'reasoning') reasoning += String(data.text ?? '')
        else if (event === 'done') {
          text = String(data.text ?? text)
          model = String(data.model ?? model)
          usage = data.usage as Record<string, unknown> | undefined
        } else if (event === 'error') throw new Error(`pip-agent ${String(data.kind ?? 'error')}`)
        else if (event !== 'meta') emit(event, data) // status/tool events pass through live; the route emits its own meta
      }
      return { text, reasoning, model, usage }
    }

    emit('status', { text: 'Pip is rummaging through the repo…' })
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': origin,
        'X-Title': 'Analytics Games Pip',
      },
      body: JSON.stringify({ ...buildOpenRouterRequest(conversation, origin), stream: true }),
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok || !response.body) throw new Error(`OpenRouter HTTP ${response.status}`)
    let text = ''
    let reasoning = ''
    for await (const chunk of parseOpenRouterStream(response.body)) {
      if (chunk.reasoning) reasoning += chunk.reasoning
      if (chunk.content) text += chunk.content
    }
    return { text, reasoning, model: PIP_MODEL }
  } finally {
    clearTimeout(timeout)
  }
}

function sseResponse(): { response: NextResponse; emit: (event: string, data: Record<string, unknown>) => void; close: () => void; failed: (error: unknown) => void } {
  const encoder = new TextEncoder()
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller
    },
  })
  const emit = (event: string, data: Record<string, unknown>) => {
    controllerRef?.enqueue(encoder.encode(encodeSse(event, data)))
  }
  const close = () => controllerRef?.close()
  const failed = (error: unknown) => controllerRef?.error(error)
  const response = new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
  return { response, emit, close, failed }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Pip chat is not configured' }, { status: 503 })
  }
  if (!consumeRateLimit(clientKey(request))) {
    return NextResponse.json({ error: 'Pip needs a tiny breather. Try again shortly.' }, { status: 429 })
  }

  let userKey: string
  let message: string
  try {
    const parsed = parsePipChatRequest(await request.json())
    userKey = parsed.userKey
    message = parsed.message
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid conversation' }, { status: 400 })
    }
    throw error
  }

  const { response, emit, close } = sseResponse()

  // The turn runs after the streaming response is returned; events flow in.
  void (async () => {
    try {
      emit('meta', { model: PIP_MODEL, runtime: process.env.PIP_AGENT_URL ? 'hermes' : 'node-shim' })

      // ── Guardrail 1: user input (fail-closed) ──────────────────────────
      if (await checkContentSafety(message, apiKey) === 'unsafe') {
        emit('blocked', { stage: 'input', message: BLOCKED_REPLY })
        return
      }

      // ── Assemble conversation from per-user server-side memory ─────────
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

      const turn = await driveTurn(conversation, request.nextUrl.origin, apiKey, emit)
      if (!turn.text.trim()) throw new Error('empty provider response')

      // ── Guardrail 2: model output, scanned BEFORE any glyph is sent ────
      if (await checkContentSafety(turn.text, apiKey) === 'unsafe') {
        emit('blocked', { stage: 'output', message: BLOCKED_REPLY })
        return
      }

      // Reasoning is model output too — only revealed after the scan passes.
      if (turn.reasoning.trim()) emit('reasoning', { text: turn.reasoning.slice(0, 4_000) })

      // Typewriter replay of the vetted answer.
      for (const chunk of chunkAnswer(turn.text)) {
        emit('delta', { text: chunk })
        await sleep(REPLAY_CHUNK_DELAY_MS)
      }

      // ── Persist the turn to the user session (best effort) ─────────────
      if (memory) {
        try {
          await savePipSession(keyHash, [...conversation, { role: 'assistant', content: turn.text }])
        } catch {
          // memory outage must not take the chat down
        }
      }

      emit('done', { text: turn.text, model: turn.model, usage: turn.usage ?? {} })
    } catch (error) {
      const kind = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'provider'
      emit('error', { kind })
    } finally {
      close()
    }
  })()

  return response
}
