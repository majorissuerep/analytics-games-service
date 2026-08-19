import type { PhysicsEventKind } from '../lib/physics'

/** Small, immediate Web Audio cues. Audio is opt-in and never queued. */
export class PinballAudio {
  private context: AudioContext | null = null
  private enabled = false
  private readonly sources = new Set<AudioScheduledSourceNode>()

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.stopAll()
  }

  isEnabled(): boolean { return this.enabled }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return null
    this.context ??= new AudioCtor()
    if (this.context.state === 'suspended') void this.context.resume()
    return this.context
  }

  private tone(frequency: number, duration: number, volume: number, slide = frequency, type: OscillatorType = 'sine'): void {
    const context = this.getContext()
    if (!context) return
    const start = context.currentTime + 0.005
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slide), start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(context.destination)
    this.sources.add(oscillator)
    oscillator.addEventListener('ended', () => this.sources.delete(oscillator), { once: true })
    oscillator.start(start)
    oscillator.stop(start + duration + 0.01)
  }

  play(kind: PhysicsEventKind | 'launch' | 'multiball' | 'tilt'): void {
    switch (kind) {
      case 'bumper': this.tone(190, 0.07, 0.055, 310, 'triangle'); break
      case 'sling': this.tone(135, 0.045, 0.045, 85, 'triangle'); break
      case 'target': this.tone(420, 0.05, 0.04, 260, 'sine'); break
      case 'spinner': this.tone(780, 0.025, 0.025, 610, 'sine'); break
      case 'ramp': this.tone(240, 0.14, 0.05, 620, 'sine'); break
      case 'jackpot':
      case 'multiball': this.tone(220, 0.22, 0.065, 880, 'triangle'); break
      case 'launch': this.tone(85, 0.11, 0.05, 180, 'triangle'); break
      case 'tilt': this.tone(92, 0.28, 0.055, 55, 'sawtooth'); break
      case 'drain': this.tone(150, 0.18, 0.04, 58, 'sine'); break
      default: break
    }
  }

  stopAll(): void {
    for (const source of this.sources) {
      try { source.stop() } catch { /* already stopped */ }
    }
    this.sources.clear()
  }

  dispose(): void {
    this.stopAll()
    if (this.context) void this.context.close()
    this.context = null
  }
}
