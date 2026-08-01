import { describe, expect, it } from 'vitest'
import { checkContentSafety, parseGuardVerdict, PIP_GUARD_MODEL } from './guardrail'

function fakeFetch(content: string, status = 200): typeof fetch {
  return (async () => new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status, headers: { 'Content-Type': 'application/json' } },
  )) as typeof fetch
}

describe('guard verdict parsing', () => {
  it('accepts a clean safe verdict', () => {
    expect(parseGuardVerdict('safe')).toBe('safe')
    expect(parseGuardVerdict('  Safe\n')).toBe('safe')
  })

  it('flags unsafe verdicts with and without category codes', () => {
    expect(parseGuardVerdict('unsafe')).toBe('unsafe')
    expect(parseGuardVerdict('unsafe\nS1,S10')).toBe('unsafe')
  })

  it('fails closed on unrecognized output', () => {
    expect(parseGuardVerdict('')).toBe('unsafe')
    expect(parseGuardVerdict('I think this is probably fine')).toBe('unsafe')
    expect(parseGuardVerdict('safely')).toBe('unsafe')
  })
})

describe('content safety checks', () => {
  it('returns safe for a clean classifier response', async () => {
    expect(await checkContentSafety('How do I play chess?', 'test-key', fakeFetch('safe'))).toBe('safe')
  })

  it('returns unsafe when the classifier flags content', async () => {
    expect(await checkContentSafety('attack', 'test-key', fakeFetch('unsafe\nS2'))).toBe('unsafe')
  })

  it('fails closed on HTTP errors, malformed payloads, and network exceptions', async () => {
    expect(await checkContentSafety('x', 'test-key', fakeFetch('safe', 500))).toBe('unsafe')
    const malformed = (async () => new Response('{}', { status: 200 })) as typeof fetch
    expect(await checkContentSafety('x', 'test-key', malformed)).toBe('unsafe')
    const broken = (async () => { throw new Error('network down') }) as typeof fetch
    expect(await checkContentSafety('x', 'test-key', broken)).toBe('unsafe')
  })

  it('uses the pinned guardrail model', () => {
    expect(PIP_GUARD_MODEL).toBe('meta-llama/llama-guard-4-12b')
  })
})
