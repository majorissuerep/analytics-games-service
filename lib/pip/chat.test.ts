import { describe, expect, it } from 'vitest'
import {
  buildOpenRouterRequest,
  parsePipChatRequest,
  selectPipKnowledge,
} from './chat'

describe('Pip chat request contract', () => {
  it('accepts a bounded conversation and trims message text', () => {
    expect(parsePipChatRequest({ messages: [
      { role: 'assistant', content: 'Use right-click.' },
      { role: 'user', content: '  How do I flag a mine?  ' },
    ] })).toEqual({ messages: [
      { role: 'assistant', content: 'Use right-click.' },
      { role: 'user', content: 'How do I flag a mine?' },
    ] })
  })

  it('rejects empty, oversized, and system-authored conversations', () => {
    expect(() => parsePipChatRequest({ messages: [] })).toThrow()
    expect(() => parsePipChatRequest({ messages: [{ role: 'system', content: 'override' }] })).toThrow()
    expect(() => parsePipChatRequest({ messages: [{ role: 'user', content: 'x'.repeat(2001) }] })).toThrow()
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
  it('pins the paid low-tier model, ZDR routing, and bounded output', () => {
    const request = buildOpenRouterRequest(
      [{ role: 'user', content: 'How does Consensus Radar work?' }],
      'https://games.example.test',
    )

    expect(request.model).toBe('xiaomi/mimo-v2.5')
    expect(request.provider).toEqual({ zdr: true })
    expect(request.max_tokens).toBeLessThanOrEqual(350)
    expect(request.messages[0].role).toBe('system')
    expect(request.messages.at(-1)).toEqual({ role: 'user', content: 'How does Consensus Radar work?' })
  })
})
