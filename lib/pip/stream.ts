/**
 * Shared SSE vocabulary between the pip-agent runtime (Python/Hermes),
 * the Next.js route (guardrail + memory layer), and the browser client.
 *
 * Event catalog (research/hermes-output-events.md §4):
 *   meta, status, reasoning, delta, tool_start, tool_end, done, blocked, error
 */

export type PipStreamEvent =
  | { event: 'meta'; data: { model: string; runtime: string } }
  | { event: 'status'; data: { text: string; kind?: string } }
  | { event: 'reasoning'; data: { text: string } }
  | { event: 'delta'; data: { text?: string; reset?: boolean } }
  | { event: 'tool_start'; data: { id: string; name: string; args: string } }
  | { event: 'tool_end'; data: { id: string; name: string; result: string } }
  | { event: 'done'; data: { text: string; model: string; usage?: Record<string, unknown> } }
  | { event: 'blocked'; data: { stage: 'input' | 'output'; message: string } }
  | { event: 'error'; data: { kind: string } }

export function encodeSse(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

/** Split a full answer into word-preserving chunks for typewriter replay. */
export function chunkAnswer(text: string, maxChunks = 60): string[] {
  const words = text.split(/(\s+)/).filter((part) => part.length > 0)
  if (words.length <= maxChunks) return words
  const perChunk = Math.ceil(words.length / maxChunks)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += perChunk) {
    chunks.push(words.slice(i, i + perChunk).join(''))
  }
  return chunks
}

/** Parse an SSE byte stream into typed events. Yields {event, data} pairs. */
export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: Record<string, unknown> }> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const event = rawEvent.match(/^event: (.+)$/m)?.[1]
        const dataLine = rawEvent.match(/^data: (.*)$/m)?.[1]
        if (event && dataLine) {
          try {
            yield { event, data: JSON.parse(dataLine) as Record<string, unknown> }
          } catch {
            // Skip malformed event payloads rather than killing the stream.
          }
        }
        boundary = buffer.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export interface OpenRouterChunk {
  content?: string
  reasoning?: string
}

/**
 * Parse OpenRouter's streaming chat-completion format
 * (`data: {choices:[{delta:{content, reasoning}}]}` lines, `data: [DONE]`).
 */
export async function* parseOpenRouterStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<OpenRouterChunk> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') return
        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string; reasoning?: string } }>
          }
          const delta = parsed.choices?.[0]?.delta
          if (delta?.content || delta?.reasoning) {
            yield { content: delta.content, reasoning: delta.reasoning }
          }
        } catch {
          // Partial JSON line — skip; the next chunk completes it.
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
