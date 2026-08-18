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
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

let enabled = loadPreference()
let ctx: AudioContext | null = null
let lastEndTime = 0

export function setSoundEnabled(next: boolean): void {
  enabled = next
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
  } catch {
    // storage unavailable (private mode, etc.) — ignore
  }
}

export function isSoundEnabled(): boolean {
  return enabled
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
  const { volume = 0.22, type = 'sine', delay = 0, attack = 0.004, slideTo } = opts

  const start = Math.max(0, lastEndTime) + delay
  lastEndTime = start + duration + 0.02

  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, audio.currentTime + start)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, audio.currentTime + start + duration)

  gain.gain.setValueAtTime(0.0001, audio.currentTime + start)
  gain.gain.exponentialRampToValueAtTime(volume, audio.currentTime + start + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + duration)

  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start(audio.currentTime + start)
  osc.stop(audio.currentTime + start + duration + 0.02)
}

function noiseBurst(duration: number, opts: { volume?: number; delay?: number; filter?: number } = {}): void {
  const audio = getContext()
  if (!audio) return
  const { volume = 0.16, delay = 0, filter = 2200 } = opts
  const start = Math.max(0, lastEndTime) + delay
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
  gain.gain.setValueAtTime(volume, audio.currentTime + start)
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + duration)
  src.connect(filterNode)
  filterNode.connect(gain)
  gain.connect(audio.destination)
  src.start(audio.currentTime + start)
}

function quietMove(): void {
  // Soft wooden thock: a short, slightly detuned pluck.
  tone(150, 0.09, { volume: 0.2, type: 'triangle', slideTo: 95 })
  noiseBurst(0.04, { volume: 0.06, filter: 900 })
}

function capture(): void {
  // Heavier, wood-on-wood clack plus the moving piece.
  tone(210, 0.1, { volume: 0.24, type: 'square' })
  tone(120, 0.12, { volume: 0.22, type: 'triangle', slideTo: 80 })
  noiseBurst(0.055, { volume: 0.12, filter: 1400 })
  tone(90, 0.14, { volume: 0.18, type: 'sine', delay: 0.02, slideTo: 60 })
}

function castle(): void {
  // Two-part roll like a rook sliding over two squares.
  tone(185, 0.08, { volume: 0.2, type: 'triangle' })
  tone(150, 0.1, { volume: 0.2, type: 'triangle', delay: 0.08 })
}

function check(): void {
  // Sharp two-tone alert.
  tone(720, 0.12, { volume: 0.18, type: 'square' })
  tone(540, 0.16, { volume: 0.16, type: 'square', delay: 0.11 })
}

function checkmate(): void {
  // A short rising fanfare.
  tone(440, 0.12, { volume: 0.2, type: 'triangle' })
  tone(554, 0.12, { volume: 0.2, type: 'triangle', delay: 0.1 })
  tone(659, 0.14, { volume: 0.2, type: 'triangle', delay: 0.2 })
  tone(880, 0.3, { volume: 0.22, type: 'triangle', delay: 0.31 })
}

function draw(): void {
  // Neutral downward pair for a drawn game.
  tone(523, 0.14, { volume: 0.18, type: 'triangle' })
  tone(392, 0.22, { volume: 0.18, type: 'triangle', delay: 0.12 })
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
  tone(330, 0.06, { volume: 0.1, type: 'sine' })
}