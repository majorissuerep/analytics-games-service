/**
 * Content guardrail: a cheap specialized safety classifier that scans Pip's
 * input and output before anything is served.
 *
 * Policy is FAIL-CLOSED: if the classifier errors, times out, or answers
 * in an unrecognized format, the content is treated as unsafe and the chat
 * turn is blocked. Availability of the chat is subordinate to safety.
 */

import { z } from 'zod'

export const PIP_GUARD_MODEL = 'meta-llama/llama-guard-4-12b'
export const GUARD_TIMEOUT_MS = 8_000

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

const guardResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string() }),
  })).min(1),
}).passthrough()

export type GuardVerdict = 'safe' | 'unsafe'

/**
 * Llama Guard answers "safe" or "unsafe" (optionally followed by hazard
 * category codes like S10). Anything else is unrecognized → fail closed.
 */
export function parseGuardVerdict(raw: string): GuardVerdict {
  const firstLine = raw.trim().toLowerCase().split('\n')[0] ?? ''
  if (firstLine === 'safe') return 'safe'
  if (firstLine.startsWith('unsafe')) return 'unsafe'
  return 'unsafe'
}

type FetchLike = typeof fetch

export async function checkContentSafety(
  text: string,
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<GuardVerdict> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GUARD_TIMEOUT_MS)
  try {
    const response = await fetchImpl(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Analytics Games Pip Guardrail',
      },
      body: JSON.stringify({
        model: PIP_GUARD_MODEL,
        max_tokens: 32,
        temperature: 0,
        messages: [{ role: 'user', content: text.slice(0, 4_000) }],
      }),
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) {
      console.warn('[pip-guard] classifier HTTP', response.status)
      return 'unsafe'
    }
    const parsed = guardResponseSchema.safeParse(await response.json())
    if (!parsed.success) {
      console.warn('[pip-guard] classifier schema mismatch')
      return 'unsafe'
    }
    return parseGuardVerdict(parsed.data.choices[0].message.content)
  } catch (error) {
    console.warn('[pip-guard] classifier exception:', error instanceof Error ? error.message : error)
    return 'unsafe'
  } finally {
    clearTimeout(timeout)
  }
}
