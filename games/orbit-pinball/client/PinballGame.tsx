'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { emitGameSessionCompleted } from '@/lib/analytics/game-events'
import {
  type Ball,
  type Collider,
  type PhysicsWorld,
  vec,
  stepWorld,
  createWorld,
} from '../lib/physics'
import {
  buildTableColliders,
  getFlippers,
  isBallDrained,
  TABLE_WIDTH,
  TABLE_HEIGHT,
} from '../lib/table'
import {
  type PinballState,
  createInitialState,
  createBall,
  launchBall,
  handleCollision,
  checkDropTargets,
  checkRolloverLanes,
  checkScoreZones,
  updateSpinner,
  handleBallDrain,
  startGame,
  getDynamicColliders,
  maybeResetDropTargets,
} from '../lib/model'
import {
  drawBackground,
  drawCollider,
  drawDropTarget,
  drawRolloverLane,
  drawSpinner,
  drawScoreZone,
  drawBall,
  drawPlunger,
  drawMessage,
} from './renderer'
import './pinball.css'

const HS_KEY = 'pinball-highscore-v3'
const GRAVITY = 1100 // px/s²

export function PinballGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  // Physics world (mutable, in refs — not React state)
  const worldRef = useRef<PhysicsWorld>(createWorld(vec(0, GRAVITY), 0.15))
  const staticCollidersRef = useRef<Collider[]>(buildTableColliders())

  // Game state — React state for HUD rendering
  const [hudState, setHudState] = useState<PinballState>(() => {
    let hs = 0
    try { hs = parseInt(localStorage.getItem(HS_KEY) ?? '0', 10) || 0 } catch { /* ignore */ }
    return createInitialState(hs)
  })

  // Plunger power (0..1)
  const [plungerPower, setPlungerPower] = useState(0)

  // Refs for game loop access — updated in effects, never during render
  const stateRef = useRef<PinballState>(hudState)
  const plungerPowerRef = useRef(0)
  const plungerChargingRef = useRef(false)
  const keysRef = useRef<Set<string>>(new Set())

  // Sync refs in effects (not during render)
  useEffect(() => { stateRef.current = hudState }, [hudState])
  useEffect(() => { plungerPowerRef.current = plungerPower }, [plungerPower])

  // ---------------------------------------------------------------------------
  // Initialize / reset game
  // ---------------------------------------------------------------------------

  const beginNewGame = useCallback(() => {
    const fresh = startGame(stateRef.current)
    const world = worldRef.current
    world.balls = []
    world.colliders = [...staticCollidersRef.current]

    const ball = createBall()
    world.balls = [ball]

    setHudState(fresh)
    setPlungerPower(0)
    plungerChargingRef.current = false
  }, [])

  // ---------------------------------------------------------------------------
  // Launch ball from plunger
  // ---------------------------------------------------------------------------

  const launchBallFromPlunger = useCallback(() => {
    const power = plungerPowerRef.current
    if (power < 0.05) return
    const world = worldRef.current
    const ball = world.balls[0]
    if (!ball || !ball.alive) return
    const launchVel = launchBall(power)
    ball.vel = launchVel
    const state = stateRef.current
    if (state.phase === 'plunger') {
      setHudState({ ...state, phase: 'playing' })
    }
    setPlungerPower(0)
    plungerChargingRef.current = false
  }, [])

  // ---------------------------------------------------------------------------
  // Keyboard input
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      keysRef.current.add(key)

      if (key === ' ' || key === 'spacebar') {
        e.preventDefault()
        const state = stateRef.current
        if (state.phase === 'ready') {
          beginNewGame()
        } else if (state.phase === 'plunger') {
          if (!plungerChargingRef.current) {
            plungerChargingRef.current = true
            setPlungerPower(0)
          }
        } else if (state.phase === 'game_over') {
          beginNewGame()
        }
      }

      if (key === 'r' && stateRef.current.phase === 'game_over') {
        beginNewGame()
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      keysRef.current.delete(key)

      if (key === ' ' || key === 'spacebar') {
        if (plungerChargingRef.current) {
          launchBallFromPlunger()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [beginNewGame, launchBallFromPlunger])

  // ---------------------------------------------------------------------------
  // Mouse / touch input for flippers
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onPointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const flippers = getFlippers(worldRef.current.colliders)
      for (const f of flippers) {
        if (f.side === 'left' && x < rect.width / 2) f.active = true
        if (f.side === 'right' && x >= rect.width / 2) f.active = true
      }
      if (stateRef.current.phase === 'plunger' && x > rect.width * 0.7) {
        plungerChargingRef.current = true
      }
    }

    const onPointerUp = () => {
      const flippers = getFlippers(worldRef.current.colliders)
      for (const f of flippers) f.active = false
      if (plungerChargingRef.current && stateRef.current.phase === 'plunger') {
        launchBallFromPlunger()
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [launchBallFromPlunger])

  // ---------------------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const loop = (now: number) => {
      const last = lastTimeRef.current || now
      let dt = (now - last) / 1000
      lastTimeRef.current = now
      dt = Math.min(dt, 1 / 30)

      const state = stateRef.current

      // --- Update flipper states from keyboard ---
      if (state.phase === 'playing' || state.phase === 'plunger') {
        const flippers = getFlippers(worldRef.current.colliders)
        const keys = keysRef.current
        for (const f of flippers) {
          if (f.side === 'left') {
            f.active = keys.has('arrowleft') || keys.has('a') || f.active
          }
          if (f.side === 'right') {
            f.active = keys.has('arrowright') || keys.has('d') || f.active
          }
        }
      }

      // --- Update plunger charge ---
      if (plungerChargingRef.current && state.phase === 'plunger') {
        setPlungerPower((p) => Math.min(1, p + dt * 1.5))
      }

      // --- Step physics ---
      if (state.phase === 'playing' || state.phase === 'plunger') {
        const world = worldRef.current

        // Update dynamic colliders (drop targets)
        const dynamicColliders = getDynamicColliders(state)
        world.colliders = [...staticCollidersRef.current, ...dynamicColliders]

        // Collision callback for scoring
        let stateChanged = false
        let newState = state

        const onCollision = (e: { collider: Collider; ball: Ball; contact: { x: number; y: number }; normal: { x: number; y: number } }) => {
          const before = newState
          newState = handleCollision(newState, e.collider, now)
          if (newState !== before) stateChanged = true

          const dropResult = checkDropTargets(newState, e.ball, now)
          if (dropResult.newColliders.length > 0 || dropResult.state !== newState) {
            newState = dropResult.state
            stateChanged = true
          }

          const afterRollover = checkRolloverLanes(newState, e.ball, now)
          if (afterRollover !== newState) {
            newState = afterRollover
            stateChanged = true
          }

          const afterZones = checkScoreZones(newState, e.ball, now)
          if (afterZones !== newState) {
            newState = afterZones
            stateChanged = true
          }
        }

        stepWorld(world, dt, onCollision)

        // Spinner update
        for (const ball of world.balls) {
          if (!ball.alive) continue
          const afterSpinner = updateSpinner(newState, ball, dt)
          if (afterSpinner !== newState) {
            newState = afterSpinner
            stateChanged = true
          }
        }

        // Check for drained balls
        let drainedCount = 0
        let aliveCount = 0
        for (const ball of world.balls) {
          if (ball.alive && isBallDrained(ball)) {
            ball.alive = false
            drainedCount += 1
          }
          if (ball.alive) aliveCount += 1
        }

        if (drainedCount > 0 && aliveCount === 0) {
          newState = handleBallDrain(newState, now)
          stateChanged = true

          if (newState.phase === 'plunger') {
            const newBall = createBall()
            world.balls = [newBall]
            setPlungerPower(0)
          } else if (newState.phase === 'game_over') {
            try {
              if (newState.highScore > 0) {
                localStorage.setItem(HS_KEY, String(newState.highScore))
              }
            } catch { /* ignore */ }
            emitGameSessionCompleted('lost')
          }
        }

        newState = maybeResetDropTargets(newState, now)

        if (newState.message && now > newState.messageUntil) {
          newState = { ...newState, message: '' }
          stateChanged = true
        }

        if (stateChanged) {
          setHudState(newState)
        }
      }

      // --- Render ---
      const renderState = stateRef.current
      const world = worldRef.current

      drawBackground(ctx)

      for (const z of renderState.scoreZones) {
        drawScoreZone(ctx, z)
      }

      for (const lane of renderState.rolloverLanes) {
        drawRolloverLane(ctx, lane)
      }

      drawSpinner(ctx, renderState.spinner)

      for (const c of staticCollidersRef.current) {
        drawCollider(ctx, c)
      }

      for (const t of renderState.dropTargets) {
        drawDropTarget(ctx, t)
      }

      for (const ball of world.balls) {
        drawBall(ctx, ball)
      }

      if (renderState.phase === 'plunger' || renderState.phase === 'playing') {
        drawPlunger(ctx, 297, 595, plungerPowerRef.current)
      }

      const isGameOver = renderState.phase === 'game_over'
      drawMessage(ctx, renderState.message, isGameOver)

      if (renderState.phase === 'ready') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
        ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT)
        ctx.font = "bold 24px 'Tahoma', sans-serif"
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#ffd629'
        ctx.fillText('PINBALL', TABLE_WIDTH / 2, TABLE_HEIGHT / 2 - 30)
        ctx.font = "14px 'Tahoma', sans-serif"
        ctx.fillStyle = '#c8d4e0'
        ctx.fillText('Press SPACE or click START', TABLE_WIDTH / 2, TABLE_HEIGHT / 2)
        ctx.font = "11px 'Tahoma', sans-serif"
        ctx.fillStyle = '#6a7080'
        ctx.fillText('← / A : left flipper', TABLE_WIDTH / 2, TABLE_HEIGHT / 2 + 25)
        ctx.fillText('→ / D : right flipper', TABLE_WIDTH / 2, TABLE_HEIGHT / 2 + 42)
        ctx.fillText('SPACE : plunger', TABLE_WIDTH / 2, TABLE_HEIGHT / 2 + 59)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [beginNewGame])

  // ---------------------------------------------------------------------------
  // Render JSX
  // ---------------------------------------------------------------------------

  const phase = hudState.phase

  return (
    <main className="pinball-app">
      <header className="pinball-header">
        <Link href="/" aria-label="Back to desktop">🪐 <strong>Pinball</strong></Link>
        <button
          className="pinball-btn pinball-btn-primary"
          onClick={() => beginNewGame()}
        >
          {phase === 'game_over' ? 'Play Again' : 'Start'}
        </button>
      </header>

      <div className="pinball-hud" role="status">
        <div className="pinball-hud-cell">
          <span className="pinball-hud-label">Score</span>
          <span className="pinball-hud-value">{hudState.score.toLocaleString()}</span>
        </div>
        <div className="pinball-hud-cell">
          <span className="pinball-hud-label">Ball</span>
          <span className="pinball-hud-value">{Math.max(1, hudState.balls)}/{hudState.maxBalls}</span>
        </div>
        <div className="pinball-hud-cell">
          <span className="pinball-hud-label">Mult</span>
          <span className="pinball-hud-value">×{hudState.multiplier}</span>
        </div>
        <div className="pinball-hud-cell">
          <span className="pinball-hud-label">Best</span>
          <span className="pinball-hud-value" style={{ fontSize: '13px' }}>{hudState.highScore.toLocaleString()}</span>
        </div>
      </div>

      <div className="pinball-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="pinball-canvas"
          width={TABLE_WIDTH}
          height={TABLE_HEIGHT}
          aria-label="Pinball playfield"
        />
        {hudState.message && phase !== 'ready' && (
          <div className={`pinball-message${phase === 'game_over' ? ' gameover' : ''}`}>
            {hudState.message}
          </div>
        )}
      </div>

      {phase === 'plunger' && (
        <div className="pinball-plunger-bar" aria-label="Plunger power">
          <div className="pinball-plunger-fill" style={{ width: `${plungerPower * 100}%` }} />
        </div>
      )}

      <div className="pinball-instructions">
        <kbd>←</kbd>/<kbd>A</kbd> left flipper · <kbd>→</kbd>/<kbd>D</kbd> right flipper · <kbd>Space</kbd> plunger · <kbd>R</kbd> restart
        <br />or tap left/right side of the table
      </div>
    </main>
  )
}
