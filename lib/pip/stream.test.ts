import { describe, expect, it } from 'vitest'
import { chunkAnswer, encodeSse, parseOpenRouterStream, parseSseStream } from './stream'

function streamOf(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text))
      controller.close()
    },
  })
}

/** Stream in awkward byte-sized pieces to prove framing survives chunking. */
function streamOfPieces(text: string, size = 7): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text)
  return new ReadableStream({
    async start(controller) {
      for (let i = 0; i < bytes.length; i += size) {
        controller.enqueue(bytes.slice(i, i + size))
      }
      controller.close()
    },
  })
}

describe('chunkAnswer', () => {
  it('keeps short answers as word tokens', () => {
    const chunks = chunkAnswer('Right-click the square!')
    expect(chunks.join('')).toBe('Right-click the square!')
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('caps long answers at maxChunks while preserving every character', () => {
    const long = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ')
    const chunks = chunkAnswer(long, 60)
    expect(chunks.length).toBeLessThanOrEqual(60)
    expect(chunks.join('')).toBe(long)
  })
})

describe('encodeSse / parseSseStream', () => {
  it('round-trips typed events', async () => {
    const wire = encodeSse('meta', { model: 'm', runtime: 'hermes' })
      + encodeSse('delta', { text: 'Hello' })
      + encodeSse('delta', { text: ' world' })
      + encodeSse('done', { text: 'Hello world', model: 'm' })
    const events = []
    for await (const item of parseSseStream(streamOf(wire))) events.push(item)
    expect(events.map((e) => e.event)).toEqual(['meta', 'delta', 'delta', 'done'])
    expect(events[3].data.text).toBe('Hello world')
  })

  it('survives events split across arbitrary byte boundaries', async () => {
    const wire = encodeSse('status', { text: 'rummaging…' }) + encodeSse('delta', { text: 'héllo ✓' })
    const events = []
    for await (const item of parseSseStream(streamOfPieces(wire))) events.push(item)
    expect(events).toHaveLength(2)
    expect(events[1].data.text).toBe('héllo ✓')
  })

  it('skips malformed payloads without killing the stream', async () => {
    const wire = 'event: delta\ndata: {broken\n\n' + encodeSse('done', { text: 'ok', model: 'm' })
    const events = []
    for await (const item of parseSseStream(streamOf(wire))) events.push(item)
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('done')
  })
})

describe('parseOpenRouterStream', () => {
  it('extracts content and reasoning deltas and stops at [DONE]', async () => {
    const wire = [
      'data: {"choices":[{"delta":{"reasoning":"think"}}]}',
      'data: {"choices":[{"delta":{"content":"Right"}}]}',
      'data: {"choices":[{"delta":{"content":"-click"}}]}',
      'data: [DONE]',
      'data: {"choices":[{"delta":{"content":"ignored"}}]}',
      '',
    ].join('\n')
    const chunks = []
    for await (const chunk of parseOpenRouterStream(streamOf(wire))) chunks.push(chunk)
    expect(chunks).toEqual([
      { reasoning: 'think', content: undefined },
      { content: 'Right', reasoning: undefined },
      { content: '-click', reasoning: undefined },
    ])
  })

  it('survives JSON split across byte boundaries', async () => {
    const wire = 'data: {"choices":[{"delta":{"content":"héllo"}}]}\ndata: [DONE]\n'
    const chunks = []
    for await (const chunk of parseOpenRouterStream(streamOfPieces(wire, 5))) chunks.push(chunk)
    expect(chunks.map((c) => c.content).join('')).toBe('héllo')
  })
})
