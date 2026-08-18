/**
 * Canvas renderer for the pinball game.
 * Pure drawing functions — no game logic here.
 */

import type { Collider, Ball, Flipper, Slingshot, SegmentWall, CircleWall, ArcWall } from '../lib/physics'
import { flipperTip } from '../lib/physics'
import { TABLE_WIDTH, TABLE_HEIGHT } from '../lib/table'
import type { DropTarget, RolloverLane, Spinner, ScoreZone } from '../lib/table'

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const COL = {
  bgTop: '#0a0a1a',
  bgBottom: '#151530',
  wall: '#3a4a6a',
  wallGlow: '#4a6a9a',
  bumper: '#ff6a3a',
  bumperGlow: '#ffaa5a',
  bumperCore: '#ffdd6a',
  post: '#8888aa',
  flipper: '#5a8aff',
  flipperGlow: '#8aaaff',
  slingshot: '#ff3a5a',
  slingshotGlow: '#ff6a8a',
  ball: '#e0e0f0',
  ballHighlight: '#ffffff',
  dropTarget: '#2a8a4a',
  dropTargetDown: '#1a2a1a',
  dropTargetText: '#aaffaa',
  rolloverLit: '#ffd629',
  rolloverDim: '#333344',
  spinner: '#aa6aff',
  spinnerGlow: '#cc8aff',
  scoreZone: 'rgba(100, 200, 100, 0.08)',
  text: '#c8d4e0',
  textDim: '#6a7080',
  drain: '#1a0a0a',
}

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

export function drawBackground(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createLinearGradient(0, 0, 0, TABLE_HEIGHT)
  grad.addColorStop(0, COL.bgTop)
  grad.addColorStop(1, COL.bgBottom)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT)

  // Subtle grid
  ctx.strokeStyle = 'rgba(30, 40, 70, 0.15)'
  ctx.lineWidth = 1
  for (let x = 0; x <= TABLE_WIDTH; x += 20) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, TABLE_HEIGHT)
    ctx.stroke()
  }
  for (let y = 0; y <= TABLE_HEIGHT; y += 20) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(TABLE_WIDTH, y)
    ctx.stroke()
  }

  // Drain area at bottom
  const drainGrad = ctx.createLinearGradient(0, TABLE_HEIGHT - 30, 0, TABLE_HEIGHT)
  drainGrad.addColorStop(0, 'rgba(40, 10, 10, 0.0)')
  drainGrad.addColorStop(1, COL.drain)
  ctx.fillStyle = drainGrad
  ctx.fillRect(0, TABLE_HEIGHT - 30, TABLE_WIDTH, 30)
}

// ---------------------------------------------------------------------------
// Colliders
// ---------------------------------------------------------------------------

export function drawCollider(ctx: CanvasRenderingContext2D, c: Collider): void {
  switch (c.kind) {
    case 'segment':
      drawSegment(ctx, c)
      break
    case 'circle':
      drawCircleWall(ctx, c)
      break
    case 'arc':
      drawArc(ctx, c)
      break
    case 'flipper':
      drawFlipper(ctx, c)
      break
    case 'slingshot':
      drawSlingshot(ctx, c)
      break
  }
}

function drawSegment(ctx: CanvasRenderingContext2D, w: SegmentWall): void {
  ctx.strokeStyle = COL.wall
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.shadowColor = COL.wallGlow
  ctx.shadowBlur = 4
  ctx.beginPath()
  ctx.moveTo(w.a.x, w.a.y)
  ctx.lineTo(w.b.x, w.b.y)
  ctx.stroke()
  ctx.shadowBlur = 0
}

function drawCircleWall(ctx: CanvasRenderingContext2D, w: CircleWall): void {
  if (w.bumper) {
    // Pop bumper — concentric circles with glow
    ctx.shadowColor = COL.bumperGlow
    ctx.shadowBlur = 12
    ctx.fillStyle = COL.bumper
    ctx.beginPath()
    ctx.arc(w.center.x, w.center.y, w.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.fillStyle = COL.bumperCore
    ctx.beginPath()
    ctx.arc(w.center.x, w.center.y, w.radius * 0.5, 0, Math.PI * 2)
    ctx.fill()

    // Ring
    ctx.strokeStyle = COL.bumperGlow
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(w.center.x, w.center.y, w.radius + 2, 0, Math.PI * 2)
    ctx.stroke()
  } else {
    // Simple post
    ctx.fillStyle = COL.post
    ctx.shadowColor = COL.post
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.arc(w.center.x, w.center.y, w.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.beginPath()
    ctx.arc(w.center.x - w.radius * 0.3, w.center.y - w.radius * 0.3, w.radius * 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawArc(ctx: CanvasRenderingContext2D, w: ArcWall): void {
  ctx.strokeStyle = COL.wall
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.shadowColor = COL.wallGlow
  ctx.shadowBlur = 4
  ctx.beginPath()
  ctx.arc(w.center.x, w.center.y, w.radius, w.startAngle, w.endAngle)
  ctx.stroke()
  ctx.shadowBlur = 0
}

function drawFlipper(ctx: CanvasRenderingContext2D, f: Flipper): void {
  const tip = flipperTip(f)

  // Glow when active
  if (f.active) {
    ctx.shadowColor = COL.flipperGlow
    ctx.shadowBlur = 10
  }

  // Draw capsule: thick line from pivot to tip
  ctx.strokeStyle = COL.flipper
  ctx.lineWidth = f.radius * 2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(f.pivot.x, f.pivot.y)
  ctx.lineTo(tip.x, tip.y)
  ctx.stroke()

  // Inner highlight
  ctx.strokeStyle = COL.flipperGlow
  ctx.lineWidth = f.radius * 0.6
  ctx.beginPath()
  ctx.moveTo(f.pivot.x, f.pivot.y)
  ctx.lineTo(tip.x, tip.y)
  ctx.stroke()

  ctx.shadowBlur = 0

  // Pivot dot
  ctx.fillStyle = '#2a2a4a'
  ctx.beginPath()
  ctx.arc(f.pivot.x, f.pivot.y, 4, 0, Math.PI * 2)
  ctx.fill()
}

function drawSlingshot(ctx: CanvasRenderingContext2D, s: Slingshot): void {
  ctx.shadowColor = COL.slingshotGlow
  ctx.shadowBlur = 8
  ctx.fillStyle = COL.slingshot
  ctx.beginPath()
  ctx.moveTo(s.vertices[0].x, s.vertices[0].y)
  ctx.lineTo(s.vertices[1].x, s.vertices[1].y)
  ctx.lineTo(s.vertices[2].x, s.vertices[2].y)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0

  // Edge highlight
  ctx.strokeStyle = COL.slingshotGlow
  ctx.lineWidth = 2
  ctx.stroke()
}

// ---------------------------------------------------------------------------
// Drop targets
// ---------------------------------------------------------------------------

export function drawDropTarget(ctx: CanvasRenderingContext2D, t: DropTarget): void {
  if (t.knockedDown) {
    ctx.fillStyle = COL.dropTargetDown
    ctx.fillRect(t.pos.x, t.pos.y + t.height - 2, t.width, 2)
  } else {
    ctx.fillStyle = COL.dropTarget
    ctx.fillRect(t.pos.x, t.pos.y, t.width, t.height)
    // Top highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.fillRect(t.pos.x, t.pos.y, t.width, 2)
    // Border
    ctx.strokeStyle = '#4aaa6a'
    ctx.lineWidth = 1
    ctx.strokeRect(t.pos.x, t.pos.y, t.width, t.height)
  }
}

// ---------------------------------------------------------------------------
// Rollover lanes
// ---------------------------------------------------------------------------

export function drawRolloverLane(ctx: CanvasRenderingContext2D, lane: RolloverLane): void {
  ctx.fillStyle = lane.lit ? COL.rolloverLit : COL.rolloverDim
  if (lane.lit) {
    ctx.shadowColor = COL.rolloverLit
    ctx.shadowBlur = 8
  }
  ctx.beginPath()
  ctx.arc(lane.pos.x, lane.pos.y, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

export function drawSpinner(ctx: CanvasRenderingContext2D, s: Spinner): void {
  ctx.save()
  ctx.translate(s.pos.x, s.pos.y)
  ctx.rotate(s.rotation)

  ctx.shadowColor = COL.spinnerGlow
  ctx.shadowBlur = 6
  ctx.fillStyle = COL.spinner
  // Draw a simple spinner shape: two crossed blades
  ctx.fillRect(-14, -2, 28, 4)
  ctx.fillRect(-2, -14, 4, 28)
  ctx.shadowBlur = 0

  // Center dot
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(0, 0, 3, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

// ---------------------------------------------------------------------------
// Score zones (subtle background tint)
// ---------------------------------------------------------------------------

export function drawScoreZone(ctx: CanvasRenderingContext2D, z: ScoreZone): void {
  ctx.fillStyle = COL.scoreZone
  ctx.fillRect(z.pos.x, z.pos.y, z.width, z.height)
  ctx.strokeStyle = 'rgba(100, 200, 100, 0.2)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.strokeRect(z.pos.x, z.pos.y, z.width, z.height)
  ctx.setLineDash([])
}

// ---------------------------------------------------------------------------
// Ball
// ---------------------------------------------------------------------------

export function drawBall(ctx: CanvasRenderingContext2D, ball: Ball): void {
  if (!ball.alive) return

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
  ctx.beginPath()
  ctx.arc(ball.pos.x + 2, ball.pos.y + 3, ball.radius, 0, Math.PI * 2)
  ctx.fill()

  // Ball body
  const grad = ctx.createRadialGradient(
    ball.pos.x - ball.radius * 0.3,
    ball.pos.y - ball.radius * 0.3,
    0,
    ball.pos.x,
    ball.pos.y,
    ball.radius,
  )
  grad.addColorStop(0, COL.ballHighlight)
  grad.addColorStop(0.5, COL.ball)
  grad.addColorStop(1, '#888899')
  ctx.fillStyle = grad
  ctx.shadowColor = 'rgba(200, 220, 255, 0.5)'
  ctx.shadowBlur = 6
  ctx.beginPath()
  ctx.arc(ball.pos.x, ball.pos.y, ball.radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Specular highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.beginPath()
  ctx.arc(ball.pos.x - ball.radius * 0.35, ball.pos.y - ball.radius * 0.35, ball.radius * 0.3, 0, Math.PI * 2)
  ctx.fill()
}

// ---------------------------------------------------------------------------
// Plunger
// ---------------------------------------------------------------------------

export function drawPlunger(ctx: CanvasRenderingContext2D, x: number, y: number, power: number): void {
  // Plunger rod
  const rodHeight = 20 + power * 15
  ctx.fillStyle = '#4a4a6a'
  ctx.fillRect(x - 4, y - rodHeight, 8, rodHeight)

  // Plunger tip
  ctx.fillStyle = '#6a6a8a'
  ctx.beginPath()
  ctx.arc(x, y - rodHeight, 6, 0, Math.PI * 2)
  ctx.fill()

  // Spring (simple zigzag)
  if (power < 0.95) {
    ctx.strokeStyle = '#5a5a7a'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    const springTop = y + 5
    const springBot = y + 30 - power * 15
    const coils = 5
    for (let i = 0; i <= coils; i++) {
      const t = i / coils
      const py = springTop + (springBot - springTop) * t
      const px = x + (i % 2 === 0 ? -5 : 5)
      if (i === 0) ctx.moveTo(x, springTop)
      else ctx.lineTo(px, py)
    }
    ctx.lineTo(x, springBot)
    ctx.stroke()
  }
}

// ---------------------------------------------------------------------------
// Message overlay
// ---------------------------------------------------------------------------

export function drawMessage(ctx: CanvasRenderingContext2D, text: string, isGameOver: boolean): void {
  if (!text) return
  ctx.save()
  ctx.font = `bold ${isGameOver ? '28px' : '22px'} 'Tahoma', sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const x = TABLE_WIDTH / 2
  const y = TABLE_HEIGHT * 0.4
  ctx.fillStyle = isGameOver ? '#ff4a6a' : '#ffd629'
  ctx.shadowColor = ctx.fillStyle
  ctx.shadowBlur = 12
  ctx.fillText(text, x, y)
  ctx.restore()
}
