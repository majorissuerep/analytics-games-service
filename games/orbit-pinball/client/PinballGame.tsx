'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { emitGameSessionCompleted } from '@/lib/analytics/game-events'
import { PinballAudio } from './audio'
import { renderTable, type TrailPoint, type VisualEffect } from './renderer'
import { PinballPhysics, type PhysicsEvent } from '../lib/physics'
import {
  createInitialState,
  handleDrain,
  handlePhysicsEvent,
  launchBall as markBallLaunched,
  registerNudge,
  serveNextBall,
  startGame,
  tickState,
  type PinballState,
  type RuleEffect,
} from '../lib/model'
import { TABLE_HEIGHT, TABLE_WIDTH } from '../lib/table'
import './pinball.css'

const HIGH_SCORE_KEY = 'neon-forge-pinball.high-score.v1'

function loadHighScore(): number {
  if (typeof window === 'undefined') return 0
  try {
    const value = Number(window.localStorage.getItem(HIGH_SCORE_KEY))
    return Number.isFinite(value) ? Math.max(0, value) : 0
  } catch {
    return 0
  }
}

function effectColor(event: PhysicsEvent): string {
  if (event.kind === 'bumper') return '#ffc857'
  if (event.kind === 'target' || event.kind === 'lock') return '#52f29b'
  if (event.kind === 'jackpot' || event.kind === 'scoop') return '#ff4fa3'
  if (event.kind === 'ramp' || event.kind === 'spinner') return '#a65cff'
  return '#24e7ff'
}

export function PinballGame() {
  const [physics] = useState(() => new PinballPhysics())
  const [audio] = useState(() => new PinballAudio())
  const [state, setState] = useState<PinballState>(() => createInitialState())
  const [highScore, setHighScore] = useState(loadHighScore)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)
  const animationRef = useRef<number | null>(null)
  const previousFrameRef = useRef(0)
  const ballSequenceRef = useRef(0)
  const shooterBallRef = useRef<string | null>(null)
  const chargeStartedRef = useRef<number | null>(null)
  const plungerPowerRef = useRef(0)
  const keysRef = useRef({ left: false, right: false })
  const effectsRef = useRef<VisualEffect[]>([])
  const effectSequenceRef = useRef(0)
  const trailsRef = useRef<Record<string, TrailPoint[]>>({})
  const completedRef = useRef(false)

  const commitState = useCallback((next: PinballState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const spawnShooterBall = useCallback(() => {
    const id = `ball-${++ballSequenceRef.current}`
    physics.spawnBall(id)
    shooterBallRef.current = id
    return id
  }, [physics])

  const applyEffects = useCallback((effects: RuleEffect[]) => {
    for (const effect of effects) {
      if (effect.type === 'target-down') physics.setTargetDown(effect.id, true)
      if (effect.type === 'reset-targets') physics.resetTargets()
      if (effect.type === 'capture-ball') physics.removeBall(effect.ballId)
      if (effect.type === 'serve-ball') spawnShooterBall()
      if (effect.type === 'spawn-multiball') {
        shooterBallRef.current = null
        const launches = [
          { at: { x: 88, y: 176 }, velocity: { x: 360, y: -260 } },
          { at: { x: 94, y: 158 }, velocity: { x: 520, y: 10 } },
          { at: { x: 81, y: 193 }, velocity: { x: 290, y: 300 } },
        ]
        launches.slice(0, effect.count).forEach(({ at, velocity }) => {
          physics.spawnBall(`ball-${++ballSequenceRef.current}`, at, velocity)
        })
        audio.play('multiball')
      }
    }
  }, [audio, physics, spawnShooterBall])

  const beginGame = useCallback(() => {
    const now = performance.now()
    physics.clearBalls()
    physics.resetTargets()
    keysRef.current = { left: false, right: false }
    effectsRef.current = []
    trailsRef.current = {}
    completedRef.current = false
    const next = startGame(now)
    commitState(next)
    spawnShooterBall()
  }, [commitState, physics, spawnShooterBall])

  const releasePlunger = useCallback(() => {
    const started = chargeStartedRef.current
    if (started === null || stateRef.current.phase !== 'plunger') return
    const power = Math.max(0.18, Math.min(1, (performance.now() - started) / 1_150))
    chargeStartedRef.current = null
    plungerPowerRef.current = 0
    const ballId = shooterBallRef.current
    if (ballId && physics.launchBall(ballId, power)) {
      commitState(markBallLaunched(stateRef.current, performance.now()))
      shooterBallRef.current = null
      audio.play('launch')
    }
  }, [audio, commitState, physics])

  const beginPlungerCharge = useCallback(() => {
    if (stateRef.current.phase === 'plunger' && chargeStartedRef.current === null) {
      chargeStartedRef.current = performance.now()
    }
  }, [])

  const nudge = useCallback((direction: -1 | 1) => {
    const before = stateRef.current
    const next = registerNudge(before, performance.now())
    if (next === before) return
    physics.nudge(direction)
    commitState(next)
    if (next.tilted && !before.tilted) audio.play('tilt')
  }, [audio, commitState, physics])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyZ') keysRef.current.left = true
      if (event.code === 'ArrowRight' || event.code === 'Slash') keysRef.current.right = true
      if (event.code === 'Space') {
        event.preventDefault()
        if (!event.repeat) beginPlungerCharge()
      }
      if ((event.code === 'ArrowUp' || event.code === 'KeyN') && !event.repeat) {
        event.preventDefault()
        nudge(event.code === 'KeyN' ? -1 : 1)
      }
    }
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyZ') keysRef.current.left = false
      if (event.code === 'ArrowRight' || event.code === 'Slash') keysRef.current.right = false
      if (event.code === 'Space') releasePlunger()
    }
    const clearKeys = () => {
      keysRef.current = { left: false, right: false }
      chargeStartedRef.current = null
    }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', clearKeys)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', clearKeys)
    }
  }, [beginPlungerCharge, nudge, releasePlunger])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = TABLE_WIDTH * ratio
    canvas.height = TABLE_HEIGHT * ratio
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(ratio, 0, 0, ratio, 0, 0)

    const addVisuals = (event: PhysicsEvent, points: number, now: number) => {
      const color = effectColor(event)
      effectsRef.current.push({ id: ++effectSequenceRef.current, x: event.x, y: event.y, startedAt: now, duration: 520, color, kind: 'pulse' })
      if (points > 0) {
        effectsRef.current.push({
          id: ++effectSequenceRef.current,
          x: event.x,
          y: event.y,
          startedAt: now,
          duration: 850,
          color,
          kind: 'score',
          text: `+${points.toLocaleString()}`,
        })
      }
      if (event.kind === 'bumper' || event.kind === 'target' || event.kind === 'jackpot') {
        effectsRef.current.push({ id: ++effectSequenceRef.current, x: event.x, y: event.y, startedAt: now, duration: 600, color, kind: 'burst' })
      }
    }

    const processDrain = (event: PhysicsEvent, now: number, current: PinballState): PinballState => {
      if (!physics.removeBall(event.ballId)) return current
      audio.play('drain')
      const update = handleDrain(current, now, physics.ballIds().length)
      applyEffects(update.effects)
      return update.state
    }

    const frame = (now: number) => {
      const elapsed = previousFrameRef.current === 0 ? 0 : Math.min(0.04, (now - previousFrameRef.current) / 1_000)
      previousFrameRef.current = now
      const current = stateRef.current
      physics.setFlippers(keysRef.current.left && !current.tilted, keysRef.current.right && !current.tilted)
      physics.advance(elapsed)

      let next = tickState(current, now)
      const events = physics.drainEvents()
      for (const event of events) {
        if (event.kind === 'drain') {
          next = processDrain(event, now, next)
          continue
        }
        const update = handlePhysicsEvent(next, event, now)
        next = update.state
        applyEffects(update.effects)
        addVisuals(event, update.points, now)
        if (update.points > 0) audio.play(event.kind)
      }

      for (const ballId of physics.ballIds()) {
        if (!physics.isOutOfBounds(ballId)) continue
        next = processDrain({ kind: 'drain', elementId: 'bounds', ballId, speed: 0, x: 210, y: 720 }, now, next)
      }

      if (next.phase === 'ball-over' && now >= next.messageUntil) {
        const update = serveNextBall(next, now)
        next = update.state
        applyEffects(update.effects)
      }

      if (next !== stateRef.current) commitState(next)

      if (next.phase === 'game-over' && !completedRef.current) {
        completedRef.current = true
        emitGameSessionCompleted('completed')
        if (next.score > highScore) {
          setHighScore(next.score)
          try {
            window.localStorage.setItem(HIGH_SCORE_KEY, String(next.score))
          } catch {
            // High scores are a best-effort local enhancement.
          }
        }
      }

      const balls = physics.getBallSnapshots()
      const activeIds = new Set(balls.map((ball) => ball.id))
      for (const ball of balls) {
        const trail = trailsRef.current[ball.id] ?? []
        trailsRef.current[ball.id] = [...trail.slice(-12), { x: ball.x, y: ball.y, alpha: Math.min(1, ball.speed / 500) }]
      }
      for (const id of Object.keys(trailsRef.current)) if (!activeIds.has(id)) delete trailsRef.current[id]
      effectsRef.current = effectsRef.current.filter((effect) => now - effect.startedAt < effect.duration)
      plungerPowerRef.current = chargeStartedRef.current === null ? 0 : Math.min(1, (now - chargeStartedRef.current) / 1_150)

      renderTable(context, {
        balls,
        flippers: physics.getFlipperSnapshots(),
        state: next,
        effects: effectsRef.current,
        trails: trailsRef.current,
        now,
        plungerPower: plungerPowerRef.current,
      })
      animationRef.current = requestAnimationFrame(frame)
    }

    animationRef.current = requestAnimationFrame(frame)
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
      previousFrameRef.current = 0
    }
  }, [applyEffects, audio, commitState, highScore, physics])

  useEffect(() => () => audio.dispose(), [audio])

  const setFlipper = (side: 'left' | 'right', active: boolean) => {
    keysRef.current[side] = active
  }
  const showOverlay = state.phase === 'attract' || state.phase === 'game-over'

  return (
    <main className="pinball-app">
      <header className="forge-header">
        <div className="forge-brand"><span>NF</span><div><b>NEON FORGE</b><small>REACTOR PINBALL</small></div></div>
        <div className="forge-actions">
          <button
            type="button"
            className="forge-icon-button"
            aria-pressed={audioEnabled}
            aria-label={audioEnabled ? 'Mute pinball sounds' : 'Enable pinball sounds'}
            onClick={() => {
              const enabled = !audioEnabled
              setAudioEnabled(enabled)
              audio.setEnabled(enabled)
            }}
          >{audioEnabled ? 'SOUND ON' : 'SOUND OFF'}</button>
          <Link href="/" className="forge-exit">Exit</Link>
        </div>
      </header>

      <section className="forge-machine" aria-label="Neon Forge pinball machine">
        <div className="forge-dmd" aria-live="polite">
          <div><small>SCORE</small><strong>{state.score.toLocaleString().padStart(7, '0')}</strong></div>
          <p>{state.message}</p>
          <div className="forge-dmd-right"><small>HIGH</small><strong>{Math.max(highScore, state.score).toLocaleString()}</strong></div>
        </div>
        <div className="forge-status-strip">
          <span>BALL <b>{Math.min(state.ballNumber, 3)}</b></span>
          <span>PLAYFIELD <b>{state.multiplier}×</b></span>
          <span>LOCK <b>{state.lockedBalls}/2</b></span>
          <span>{state.multiball ? 'MULTIBALL' : state.mode ? 'REACTOR RUSH' : `TURBINE ${state.spinnerCharge}/12`}</span>
        </div>
        <div className="forge-canvas-wrap">
          <canvas ref={canvasRef} aria-label="Neon Forge pinball playfield" />
          {showOverlay && (
            <div className="forge-overlay">
              <span className="forge-overlay-kicker">ORIGINAL REACTOR TABLE</span>
              <h1>{state.phase === 'game-over' ? 'SHIFT COMPLETE' : 'LIGHT THE FORGE'}</h1>
              {state.phase === 'game-over'
                ? <p>Final score <strong>{state.score.toLocaleString()}</strong><br />Jackpots collected {state.jackpots}</p>
                : <p>Complete F·O·R·G·E, lock two balls,<br />then shoot the core for jackpots.</p>}
              <button type="button" onClick={beginGame}>{state.phase === 'game-over' ? 'PLAY AGAIN' : 'START GAME'}</button>
              <small>← / Z left flipper · → / / right flipper · Space launch · N nudge</small>
            </div>
          )}
        </div>

        <div className="forge-controls" aria-label="Pinball touch controls">
          <button
            type="button"
            className="forge-flip left"
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setFlipper('left', true) }}
            onPointerUp={() => setFlipper('left', false)}
            onPointerCancel={() => setFlipper('left', false)}
          ><span>LEFT</span><b>FLIP</b></button>
          <button type="button" className="forge-nudge" onClick={() => nudge(-1)}>NUDGE</button>
          <button
            type="button"
            className="forge-launch"
            disabled={state.phase !== 'plunger'}
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); beginPlungerCharge() }}
            onPointerUp={releasePlunger}
            onPointerCancel={releasePlunger}
          ><span>HOLD</span><b>LAUNCH</b></button>
          <button
            type="button"
            className="forge-flip right"
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setFlipper('right', true) }}
            onPointerUp={() => setFlipper('right', false)}
            onPointerCancel={() => setFlipper('right', false)}
          ><span>RIGHT</span><b>FLIP</b></button>
        </div>
      </section>
      <p className="forge-rules">FORGE bank → lock · 2 locks → multiball · turbine → ramp cashout · scoop → 2× Reactor Rush · three nudges → tilt</p>
    </main>
  )
}
