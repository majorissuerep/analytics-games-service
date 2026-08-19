// Synthesised board sounds via the Web Audio API. No audio assets are shipped;
// every sound is a tiny oscillator envelope generated on demand. This keeps the
// game self-contained and avoids a network request for clips.
//
// The AudioContext is created lazily on the first sound and only ever resumed
// from a user-gesture path, which satisfies the browser autoplay policy.

export interface MoveSoundDescriptor {
  /** A piece was captured on this move. */
  capture?: boolean
  /** The move resulted in check. */
  check?: boolean
  /** The game ended by checkmate. */
  checkmate?: boolean
  /** The game ended by stalemate / draw. */
  draw?: boolean
  /** A king was castled. */
  castle?: boolean
}

const STORAGE_KEY = 'analytics-chess.sound-enabled'

function loadPreference(): boolean {
  try {
    // Sound is deliberately opt-in. The former default-on synthesizer could
    // start after a board gesture and was surprising in the desktop shell.
    return localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

let enabled = loadPreference()
let ctx: AudioContext | null = null
let lastEndTime = 0
const activeSources = new Set<AudioScheduledSourceNode>()

function trackSource(source: AudioScheduledSourceNode): void {
  activeSources.add(source)
  source.addEventListener('ended', () => activeSources.delete(source), { once: true })
}

function stopScheduledSounds(): void {
  for (const source of activeSources) {
    try { source.stop() } catch { /* already stopped */ }
  }
  activeSources.clear()
  lastEndTime = 0
}

export function setSoundEnabled(next: boolean): void {
  enabled = next
  if (!next) {
    stopScheduledSounds()
    if (ctx?.state === 'running') void ctx.suspend()
  }
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
  } catch {
    // storage unavailable (private mode, etc.) — ignore
  }
}

export function isSoundEnabled(): boolean {
  return enabled
}

/** Stop pending tones when the chess view unmounts or loses ownership. */
export function disposeChessSound(): void {
  stopScheduledSounds()
  if (ctx?.state === 'running') void ctx.suspend()
}

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(
  frequency: number,
  duration: number,
  opts: {
    volume?: number
    type?: OscillatorType
    delay?: number
    attack?: number
    slideTo?: number
  } = {},
): void {
  const audio = getContext()
  if (!audio) return
  const { volume = 0.09, type = 'sine', delay = 0, attack = 0.004, slideTo } = opts

  // Web Audio times are absolute. The previous implementation stored a
  // relative offset and added currentTime again on every move, causing an
  // ever-growing queue of stale tones that sounded minutes later.
  const start = Math.max(audio.currentTime + 0.006, lastEndTime) + delay
  lastEndTime = start + duration + 0.02

  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, start)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration)

  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  osc.connect(gain)
  gain.connect(audio.destination)
  trackSource(osc)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

function noiseBurst(duration: number, opts: { volume?: number; delay?: number; filter?: number } = {}): void {
  const audio = getContext()
  if (!audio) return
  const { volume = 0.04, delay = 0, filter = 1200 } = opts
  const start = Math.max(audio.currentTime + 0.006, lastEndTime) + delay
  lastEndTime = start + duration + 0.02

  const buffer = audio.createBuffer(1, Math.max(1, Math.floor(audio.sampleRate * duration)), audio.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  const src = audio.createBufferSource()
  src.buffer = buffer
  const gain = audio.createGain()
  const filterNode = audio.createBiquadFilter()
  filterNode.type = 'lowpass'
  filterNode.frequency.value = filter
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  src.connect(filterNode)
  filterNode.connect(gain)
  gain.connect(audio.destination)
  trackSource(src)
  src.start(start)
}

function quietMove(): void {
  // Soft wooden thock: a short, slightly detuned pluck.
  tone(125, 0.055, { volume: 0.07, type: 'sine', slideTo: 82 })
  noiseBurst(0.025, { volume: 0.025, filter: 700 })
}

function capture(): void {
  // Heavier, wood-on-wood clack plus the moving piece.
  tone(150, 0.06, { volume: 0.08, type: 'triangle', slideTo: 92 })
  noiseBurst(0.035, { volume: 0.035, filter: 900 })
  tone(78, 0.08, { volume: 0.05, type: 'sine', slideTo: 58 })
}

function castle(): void {
  // Two-part roll like a rook sliding over two squares.
  tone(135, 0.05, { volume: 0.065, type: 'triangle' })
  tone(105, 0.06, { volume: 0.06, type: 'triangle', delay: 0.025 })
}

function check(): void {
  // Restrained low bell rather than an arcade-style alert.
  tone(260, 0.09, { volume: 0.065, type: 'sine' })
  tone(195, 0.11, { volume: 0.05, type: 'sine', delay: 0.025 })
}

function checkmate(): void {
  // A short rising fanfare.
  tone(196, 0.1, { volume: 0.07, type: 'sine' })
  tone(247, 0.1, { volume: 0.065, type: 'sine', delay: 0.04 })
  tone(294, 0.18, { volume: 0.065, type: 'sine', delay: 0.04 })
}

function draw(): void {
  // Neutral downward pair for a drawn game.
  tone(220, 0.1, { volume: 0.055, type: 'sine' })
  tone(165, 0.14, { volume: 0.05, type: 'sine', delay: 0.035 })
}

/**
 * Play the sound(s) that match the most recently played move. Call this after a
 * move has been applied to the board, passing descriptors gathered from the
 * resulting position.
 */
export function playMoveSound(descriptor: MoveSoundDescriptor): void {
  if (!enabled) return
  if (descriptor.checkmate) return checkmate()
  if (descriptor.draw) return draw()
  if (descriptor.check) return check()
  if (descriptor.castle) return castle()
  if (descriptor.capture) return capture()
  quietMove()
}

/** A soft click used for undo and other neutral actions. */
export function playUndoSound(): void {
  if (!enabled) return
  tone(110, 0.045, { volume: 0.04, type: 'sine' })
}