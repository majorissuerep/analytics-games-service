import { afterEach, describe, expect, it, vi } from 'vitest'

class FakeParam {
  events: number[] = []
  setValueAtTime(_value: number, time: number) { this.events.push(time) }
  exponentialRampToValueAtTime(_value: number, time: number) { this.events.push(time) }
}

class FakeSource {
  starts: number[] = []
  stops: number[] = []
  stopped = false
  addEventListener() {}
  connect() { return this }
  start(time: number) { this.starts.push(time) }
  stop(time?: number) { this.stopped = true; if (time !== undefined) this.stops.push(time) }
}

class FakeAudioContext {
  currentTime = 10
  state: AudioContextState = 'running'
  sampleRate = 48_000
  sources: FakeSource[] = []
  destination = {}
  createOscillator() {
    const source = new FakeSource() as FakeSource & { type: OscillatorType; frequency: FakeParam }
    source.type = 'sine'
    source.frequency = new FakeParam()
    this.sources.push(source)
    return source
  }
  createGain() { return { gain: new FakeParam(), connect() {} } }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) } }
  createBufferSource() {
    const source = new FakeSource() as FakeSource & { buffer: unknown }
    source.buffer = null
    this.sources.push(source)
    return source
  }
  createBiquadFilter() { return { type: 'lowpass', frequency: { value: 0 }, connect() {} } }
  resume() { this.state = 'running'; return Promise.resolve() }
  suspend() { this.state = 'suspended'; return Promise.resolve() }
}

const storage = new Map<string, string>()
let context: FakeAudioContext

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
  storage.clear()
})

async function loadSound() {
  context = new FakeAudioContext()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  })
  vi.stubGlobal('window', { AudioContext: class { constructor() { return context } } })
  return import('./sound')
}

describe('chess sound ownership and scheduling', () => {
  it('is opt-in for a new browser', async () => {
    const sound = await loadSound()
    expect(sound.isSoundEnabled()).toBe(false)
    sound.playMoveSound({ check: true })
    expect(context.sources).toHaveLength(0)
  })

  it('uses absolute Web Audio times instead of building a stale relative queue', async () => {
    const sound = await loadSound()
    sound.setSoundEnabled(true)
    for (let move = 0; move < 20; move += 1) {
      context.currentTime = 10 + move * 4
      sound.playMoveSound({})
      const latest = context.sources.at(-1)
      expect(latest?.starts[0]).toBeLessThan(context.currentTime + 0.5)
    }
  })

  it('stops scheduled sources when muted or disposed', async () => {
    const sound = await loadSound()
    sound.setSoundEnabled(true)
    sound.playMoveSound({ capture: true })
    expect(context.sources.length).toBeGreaterThan(0)
    sound.setSoundEnabled(false)
    expect(context.sources.every((source) => source.stopped)).toBe(true)
  })
})
