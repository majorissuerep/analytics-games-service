'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  createPinballState,
  launchPinball,
  PINBALL_BALL_RADIUS,
  PINBALL_BUMPERS,
  PINBALL_HEIGHT,
  PINBALL_WIDTH,
  stepPinball,
  type PinballControls,
  type PinballState,
} from '../model'
import './orbit-pinball.css'

function drawFlipper(context: CanvasRenderingContext2D, x: number, y: number, mirror: boolean, active: boolean) {
  context.save()
  context.translate(x, y)
  context.rotate((mirror ? -1 : 1) * (active ? -0.34 : 0.18))
  context.fillStyle = '#ffb12b'
  context.strokeStyle = '#fff1a8'
  context.lineWidth = 4
  context.beginPath()
  context.roundRect(mirror ? -105 : 0, -12, 105, 24, 12)
  context.fill()
  context.stroke()
  context.restore()
}

function drawTable(context: CanvasRenderingContext2D, state: PinballState, controls: PinballControls) {
  const gradient = context.createLinearGradient(0, 0, 0, PINBALL_HEIGHT)
  gradient.addColorStop(0, '#111a56')
  gradient.addColorStop(1, '#17052b')
  context.fillStyle = gradient
  context.fillRect(0, 0, PINBALL_WIDTH, PINBALL_HEIGHT)

  context.strokeStyle = '#53d9ff'
  context.lineWidth = 5
  context.strokeRect(25, 23, PINBALL_WIDTH - 50, PINBALL_HEIGHT - 46)
  context.fillStyle = 'rgba(58, 217, 255, .12)'
  context.beginPath()
  context.arc(300, 280, 185, 0, Math.PI * 2)
  context.fill()

  for (const bumper of PINBALL_BUMPERS) {
    const glow = context.createRadialGradient(bumper.x, bumper.y, 5, bumper.x, bumper.y, bumper.radius)
    glow.addColorStop(0, '#fffbd1')
    glow.addColorStop(.35, '#ffbd27')
    glow.addColorStop(1, '#e34967')
    context.fillStyle = glow
    context.strokeStyle = '#fff3b0'
    context.lineWidth = 4
    context.beginPath()
    context.arc(bumper.x, bumper.y, bumper.radius, 0, Math.PI * 2)
    context.fill()
    context.stroke()
  }

  context.strokeStyle = '#9259ff'
  context.lineWidth = 13
  context.beginPath()
  context.moveTo(28, 585)
  context.lineTo(125, 675)
  context.moveTo(PINBALL_WIDTH - 28, 585)
  context.lineTo(PINBALL_WIDTH - 125, 675)
  context.stroke()

  drawFlipper(context, 190, 660, false, controls.left)
  drawFlipper(context, 410, 660, true, controls.right)

  context.shadowColor = '#ffffff'
  context.shadowBlur = 14
  context.fillStyle = '#e9fbff'
  context.beginPath()
  context.arc(state.ball.x, state.ball.y, PINBALL_BALL_RADIUS, 0, Math.PI * 2)
  context.fill()
  context.shadowBlur = 0
}

export function OrbitPinballGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(createPinballState())
  const controls = useRef<PinballControls>({ left: false, right: false })
  const [hud, setHud] = useState(createPinballState)

  useEffect(() => {
    let animation = 0
    let last = performance.now()
    let lastHud = last
    const frame = (now: number) => {
      const elapsed = (now - last) / 1_000
      last = now
      stateRef.current = stepPinball(stateRef.current, elapsed, controls.current)
      const context = canvasRef.current?.getContext('2d')
      if (context) drawTable(context, stateRef.current, controls.current)
      if (now - lastHud > 100) {
        lastHud = now
        setHud(stateRef.current)
      }
      animation = requestAnimationFrame(frame)
    }
    animation = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animation)
  }, [])

  useEffect(() => {
    const key = (pressed: boolean) => (event: KeyboardEvent) => {
      if (event.code === 'ArrowLeft') controls.current.left = pressed
      if (event.code === 'ArrowRight') controls.current.right = pressed
      if (event.code === 'Space' && pressed) stateRef.current = launchPinball(stateRef.current)
      if (event.code === 'ArrowLeft' || event.code === 'ArrowRight' || event.code === 'Space') event.preventDefault()
    }
    const down = key(true)
    const up = key(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const newGame = () => {
    stateRef.current = createPinballState()
    setHud(stateRef.current)
  }
  const launch = () => {
    stateRef.current = launchPinball(stateRef.current)
    setHud(stateRef.current)
  }
  const setFlipper = (side: keyof PinballControls, pressed: boolean) => {
    controls.current[side] = pressed
  }

  return (
    <main className="pinball-app">
      <header className="pinball-header">
        <Link href="/" aria-label="Back to desktop">🪐 <strong>Orbit Pinball</strong></Link>
        <div><output aria-label="Score">{String(hud.score).padStart(7, '0')}</output><span>BALLS {hud.lives}</span></div>
      </header>
      <section className="pinball-cabinet">
        <canvas ref={canvasRef} width={PINBALL_WIDTH} height={PINBALL_HEIGHT} aria-label="Orbit Pinball table" />
        <div className="pinball-message" role="status">
          {hud.status === 'ready' ? 'Ball ready — launch!' : hud.status === 'over' ? `Game over · ${hud.score} points` : 'Orbit active'}
        </div>
        <div className="pinball-controls">
          <button
            onPointerDown={() => setFlipper('left', true)}
            onPointerUp={() => setFlipper('left', false)}
            onPointerLeave={() => setFlipper('left', false)}
          >← Left flipper</button>
          {hud.status === 'over'
            ? <button className="pinball-launch" onClick={newGame}>New game</button>
            : <button className="pinball-launch" onClick={launch} disabled={hud.status !== 'ready'}>Launch</button>}
          <button
            onPointerDown={() => setFlipper('right', true)}
            onPointerUp={() => setFlipper('right', false)}
            onPointerLeave={() => setFlipper('right', false)}
          >Right flipper →</button>
        </div>
        <p>Keyboard: ← → flippers · Space launch</p>
      </section>
    </main>
  )
}
