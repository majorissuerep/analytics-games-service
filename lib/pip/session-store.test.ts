import { describe, expect, it } from 'vitest'
import {
  hashUserKey,
  loadPipSession,
  PIP_SESSION_MAX_MESSAGES,
  savePipSession,
  trimSessionMessages,
} from './session-store'

function fakeQueryable(rows: Array<Record<string, unknown>> = []) {
  const calls: Array<{ text: string; values?: unknown[] }> = []
  return {
    calls,
    query: async (text: string, values?: unknown[]) => {
      calls.push({ text, values })
      return { rows }
    },
  }
}

describe('user key hashing', () => {
  it('produces a stable namespaced sha256 hash, never the raw key', () => {
    const hash = hashUserKey('user-key-123')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe(hashUserKey('user-key-123'))
    expect(hash).not.toContain('user-key-123')
    expect(hash).not.toBe(hashUserKey('user-key-124'))
  })
})

describe('session transcript trimming', () => {
  it('keeps only the most recent messages up to the cap', () => {
    const many = Array.from({ length: PIP_SESSION_MAX_MESSAGES + 5 }, (_, index) => ({
      role: 'user' as const,
      content: `message-${index}`,
    }))
    const trimmed = trimSessionMessages(many)
    expect(trimmed).toHaveLength(PIP_SESSION_MAX_MESSAGES)
    expect(trimmed.at(-1)?.content).toBe(`message-${PIP_SESSION_MAX_MESSAGES + 4}`)
  })

  it('drops empty and oversized content and unknown roles', () => {
    const trimmed = trimSessionMessages([
      { role: 'user', content: '   ' },
      { role: 'assistant', content: 'x'.repeat(3000) },
      { role: 'system' as 'user', content: 'smuggled' },
      { role: 'user', content: 'real question' },
    ])
    expect(trimmed).toHaveLength(2)
    expect(trimmed[0].content).toHaveLength(2000)
    expect(trimmed[1].content).toBe('real question')
  })
})

describe('session persistence', () => {
  it('returns an empty history for unknown or expired sessions', async () => {
    const store = fakeQueryable([])
    expect(await loadPipSession('hash', store)).toEqual([])
    expect(store.calls[0].text).toContain('expires_at > NOW()')
  })

  it('trims rows loaded from the database', async () => {
    const store = fakeQueryable([{ messages: [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ] }])
    expect(await loadPipSession('hash', store)).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ])
  })

  it('upserts with a sliding TTL and cleans up expired rows', async () => {
    const store = fakeQueryable([])
    await savePipSession('hash', [{ role: 'user', content: 'remember me' }], store)
    expect(store.calls).toHaveLength(2)
    expect(store.calls[0].text).toContain('ON CONFLICT (user_key_hash) DO UPDATE')
    expect(store.calls[0].values?.[0]).toBe('hash')
    expect(store.calls[0].values?.[1]).toBe('[{"role":"user","content":"remember me"}]')
    expect(store.calls[1].text).toContain('DELETE FROM pip_sessions WHERE expires_at <= NOW()')
  })
})
