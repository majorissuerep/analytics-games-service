import { describe, expect, it } from 'vitest'
import {
  buildOpenRouterRequest,
  parsePipChatRequest,
  selectPipKnowledge,
} from './chat'

const VALID_USER_KEY = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789'

describe('Pip chat request contract', () => {
  it('accepts an opaque user key and trims the message text', () => {
    expect(parsePipChatRequest({ userKey: VALID_USER_KEY, message: '  How do I flag a mine?  ' }))
      .toEqual({ userKey: VALID_USER_KEY, message: 'How do I flag a mine?' })
  })

  it('rejects missing keys, malformed keys, and oversized messages', () => {
    expect(() => parsePipChatRequest({ message: 'hi' })).toThrow()
    expect(() => parsePipChatRequest({ userKey: 'short', message: 'hi' })).toThrow()
    expect(() => parsePipChatRequest({ userKey: 'has spaces in it!!', message: 'hi' })).toThrow()
    expect(() => parsePipChatRequest({ userKey: VALID_USER_KEY, message: '' })).toThrow()
    expect(() => parsePipChatRequest({ userKey: VALID_USER_KEY, message: 'x'.repeat(2001) })).toThrow()
  })

  it('rejects transcript smuggling and unexpected fields', () => {
    expect(() => parsePipChatRequest({ userKey: VALID_USER_KEY, message: 'hi', messages: [] })).toThrow()
    expect(() => parsePipChatRequest({ userKey: VALID_USER_KEY, message: 'hi', role: 'system' })).toThrow()
  })
})

describe('Pip repository knowledge', () => {
  it('retrieves game rules and relevant implementation paths', () => {
    const knowledge = selectPipKnowledge('How do I play Minefield and where is its code?')
    expect(knowledge).toContain('Minefield')
    expect(knowledge).toContain('games/minefield')
    expect(knowledge).not.toContain('Orbit Pinball')
  })

  it('always includes a concise platform overview', () => {
    expect(selectPipKnowledge('hello')).toContain('Next.js')
  })
})

describe('OpenRouter privacy and spend controls', () => {
  it('pins the deepseek flash model, ZDR routing, and bounded output', () => {
    const request = buildOpenRouterRequest(
      [{ role: 'user', content: 'How does Consensus Radar work?' }],
      'https://games.example.test',
    )

    expect(request.model).toBe('deepseek/deepseek-v4-flash')
    expect(request.provider).toEqual({ zdr: true })
    expect(request.max_tokens).toBeLessThanOrEqual(350)
    expect(request.messages[0].role).toBe('system')
    expect(request.messages.at(-1)).toEqual({ role: 'user', content: 'How does Consensus Radar work?' })
  })
})
