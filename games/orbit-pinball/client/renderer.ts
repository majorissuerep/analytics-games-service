import type { BallSnapshot, FlipperSnapshot } from '../lib/physics'
import type { PinballState } from '../lib/model'
import {
  BUMPERS,
  DROP_TARGETS,
  PLAYFIELD_RAILS,
  POSTS,
  SENSORS,
  SLINGSHOTS,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  type Point,
} from '../lib/table'

export interface VisualEffect {
  id: number
  x: number
  y: number
  startedAt: number
  duration: number
  color: string
  kind: 'burst' | 'pulse' | 'score'
  text?: string
}

export interface TrailPoint extends Point { alpha: number }

export interface RenderScene {
  balls: BallSnapshot[]
  flippers: FlipperSnapshot[]
  state: PinballState
  effects: VisualEffect[]
  trails: Record<string, TrailPoint[]>
  now: number
  plungerPower: number
}

const C = {
  ink: '#030712',
  panel: '#081426',
  panel2: '#0d2035',
  cyan: '#24e7ff',
  blue: '#5088ff',
  violet: '#a65cff',
  magenta: '#ff4fa3',
  amber: '#ffc857',
  red: '#ff465c',
  green: '#52f29b',
  metal: '#9bb7ce',
  dim: '#273d55',
  white: '#effcff',
}

function linePath(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  if (points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y)
}

function glowLine(ctx: CanvasRenderingContext2D, points: readonly Point[], color = C.cyan, width = 3): void {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  linePath(ctx, points)
  ctx.strokeStyle = 'rgba(0,0,0,.7)'
  ctx.lineWidth = width + 7
  ctx.stroke()
  linePath(ctx, points)
  ctx.shadowColor = color
  ctx.shadowBlur = 10
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
  linePath(ctx, points)
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255,255,255,.75)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

function polygon(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y)
  ctx.closePath()
}

function drawBackdrop(ctx: CanvasRenderingContext2D, now: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, TABLE_HEIGHT)
  gradient.addColorStop(0, '#06182b')
  gradient.addColorStop(0.48, '#091225')
  gradient.addColorStop(1, '#02050d')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT)

  const coreGlow = ctx.createRadialGradient(220, 360, 12, 220, 360, 250)
  coreGlow.addColorStop(0, 'rgba(38,231,255,.13)')
  coreGlow.addColorStop(0.45, 'rgba(166,92,255,.07)')
  coreGlow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = coreGlow
  ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT)

  ctx.save()
  ctx.globalAlpha = 0.16
  ctx.strokeStyle = C.blue
  ctx.lineWidth = 1
  for (let y = 25; y < TABLE_HEIGHT; y += 34) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(TABLE_WIDTH, y - 18)
    ctx.stroke()
  }
  ctx.restore()

  const pulse = 0.45 + Math.sin(now / 700) * 0.12
  ctx.save()
  ctx.globalAlpha = pulse
  ctx.strokeStyle = 'rgba(36,231,255,.15)'
  ctx.lineWidth = 1
  for (let radius = 58; radius < 180; radius += 32) {
    ctx.beginPath()
    ctx.arc(218, 360, radius, 0.15, Math.PI * 1.18)
    ctx.stroke()
  }
  ctx.restore()

  // Shooter-lane carbon panel.
  const shooter = ctx.createLinearGradient(350, 0, 410, 0)
  shooter.addColorStop(0, 'rgba(12,28,48,.84)')
  shooter.addColorStop(1, 'rgba(3,8,17,.94)')
  ctx.fillStyle = shooter
  ctx.fillRect(350, 92, 56, 600)
  ctx.fillStyle = 'rgba(36,231,255,.06)'
  for (let y = 130; y < 680; y += 22) ctx.fillRect(354, y, 47, 1)
}

function drawPlayfieldPlastics(ctx: CanvasRenderingContext2D, now: number): void {
  const glassPanel = (points: readonly Point[], color: string): void => {
    ctx.save()
    polygon(ctx, points)
    const gradient = ctx.createLinearGradient(points[0].x, points[0].y, points[points.length - 1].x, points[points.length - 1].y)
    gradient.addColorStop(0, 'rgba(20, 44, 68, .82)')
    gradient.addColorStop(1, 'rgba(4, 12, 25, .32)')
    ctx.fillStyle = gradient
    ctx.fill()
    ctx.strokeStyle = color
    ctx.globalAlpha = .58
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.globalAlpha = .18
    ctx.strokeStyle = C.white
    ctx.lineWidth = 1
    ctx.translate(3, 3)
    polygon(ctx, points)
    ctx.stroke()
    ctx.restore()
  }

  glassPanel([
    { x: 34, y: 124 }, { x: 83, y: 77 }, { x: 118, y: 91 },
    { x: 87, y: 176 }, { x: 60, y: 284 }, { x: 39, y: 333 },
  ], C.cyan)
  glassPanel([
    { x: 292, y: 92 }, { x: 326, y: 124 }, { x: 340, y: 324 },
    { x: 319, y: 282 }, { x: 296, y: 169 },
  ], C.blue)

  const apron = ctx.createLinearGradient(0, 515, 0, 710)
  apron.addColorStop(0, 'rgba(10, 26, 46, .12)')
  apron.addColorStop(.62, 'rgba(7, 18, 34, .72)')
  apron.addColorStop(1, 'rgba(2, 6, 14, .96)')
  ctx.fillStyle = apron
  polygon(ctx, [
    { x: 30, y: 512 }, { x: 72, y: 526 }, { x: 96, y: 615 },
    { x: 118, y: 705 }, { x: 290, y: 705 }, { x: 310, y: 615 },
    { x: 334, y: 526 }, { x: 351, y: 512 }, { x: 351, y: 706 }, { x: 30, y: 706 },
  ])
  ctx.fill()

  const pulse = .42 + Math.sin(now / 420) * .12
  ctx.save()
  ctx.globalAlpha = pulse
  ctx.fillStyle = C.cyan
  for (const [x, direction] of [[68, -1], [316, 1]] as const) {
    ctx.save()
    ctx.translate(x, 577)
    ctx.scale(direction, 1)
    polygon(ctx, [{ x: -7, y: 11 }, { x: 0, y: -10 }, { x: 7, y: 11 }, { x: 0, y: 5 }])
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()

  ctx.save()
  ctx.fillStyle = '#405e76'
  ctx.font = '800 9px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('RETURN', 69, 603)
  ctx.fillText('RETURN', 314, 603)
  ctx.fillStyle = C.amber
  ctx.font = '900 10px system-ui, sans-serif'
  ctx.translate(387, 405)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('TURBINE LAUNCH', 0, 0)
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = .36
  ctx.strokeStyle = C.violet
  ctx.lineWidth = 1.5
  for (let radius = 36; radius <= 96; radius += 20) {
    ctx.beginPath()
    ctx.arc(238, 365, radius, Math.PI * .63, Math.PI * 1.62)
    ctx.stroke()
  }
  ctx.restore()
}

function drawBrand(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.fillStyle = C.white
  ctx.shadowColor = C.cyan
  ctx.shadowBlur = 14
  ctx.font = '900 23px system-ui, sans-serif'
  ctx.fillText('NEON FORGE', 211, 121)
  ctx.shadowBlur = 0
  ctx.fillStyle = C.amber
  ctx.font = '700 8px system-ui, sans-serif'
  ctx.letterSpacing = '3px'
  ctx.fillText('REACTOR DIVISION', 211, 136)
  ctx.restore()
}

function drawRails(ctx: CanvasRenderingContext2D): void {
  for (const rail of PLAYFIELD_RAILS) {
    const color = rail.id.startsWith('ramp') ? C.violet : rail.id.startsWith('shooter') ? C.amber : C.cyan
    glowLine(ctx, rail.points, color, rail.id.startsWith('ramp') ? 2 : 3)
  }
}

function drawRamp(ctx: CanvasRenderingContext2D, state: PinballState, now: number): void {
  ctx.save()
  const gradient = ctx.createLinearGradient(170, 500, 260, 330)
  gradient.addColorStop(0, 'rgba(80,136,255,.08)')
  gradient.addColorStop(1, state.multiball ? 'rgba(255,79,163,.3)' : 'rgba(166,92,255,.2)')
  ctx.fillStyle = gradient
  polygon(ctx, [{ x: 168, y: 490 }, { x: 226, y: 497 }, { x: 270, y: 334 }, { x: 226, y: 332 }])
  ctx.fill()
  ctx.clip()
  ctx.globalAlpha = 0.45 + Math.sin(now / 230) * 0.15
  ctx.strokeStyle = state.multiball ? C.magenta : C.violet
  ctx.lineWidth = 3
  for (let y = 456; y > 350; y -= 32) {
    ctx.beginPath()
    ctx.moveTo(190, y)
    ctx.lineTo(216, y - 18)
    ctx.lineTo(237, y)
    ctx.stroke()
  }
  ctx.restore()

  ctx.save()
  ctx.translate(242, 355)
  const core = 14 + Math.sin(now / 180) * 2
  ctx.shadowColor = state.multiball ? C.magenta : C.cyan
  ctx.shadowBlur = state.multiball ? 24 : 14
  ctx.strokeStyle = state.multiball ? C.magenta : C.cyan
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(0, 0, core, 0, Math.PI * 2)
  ctx.stroke()
  ctx.rotate(now / 700)
  for (let i = 0; i < 4; i += 1) {
    ctx.rotate(Math.PI / 2)
    ctx.fillStyle = C.amber
    ctx.fillRect(15, -2, 8, 4)
  }
  ctx.restore()
}

function drawBumpers(ctx: CanvasRenderingContext2D, effects: VisualEffect[], now: number): void {
  for (const bumper of BUMPERS) {
    const hit = effects.some((effect) => effect.kind === 'pulse' && Math.hypot(effect.x - bumper.x, effect.y - bumper.y) < 35)
    const pulse = hit ? 1.15 : 1 + Math.sin(now / 460 + bumper.x) * 0.025
    ctx.save()
    ctx.translate(bumper.x, bumper.y)
    ctx.scale(pulse, pulse)
    const outer = ctx.createRadialGradient(-6, -7, 2, 0, 0, bumper.radius + 7)
    outer.addColorStop(0, C.white)
    outer.addColorStop(0.24, C.amber)
    outer.addColorStop(0.52, '#ff6f45')
    outer.addColorStop(1, '#7b163d')
    ctx.shadowColor = hit ? C.white : C.magenta
    ctx.shadowBlur = hit ? 28 : 13
    ctx.fillStyle = outer
    ctx.beginPath()
    ctx.arc(0, 0, bumper.radius + 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = 'rgba(255,255,255,.85)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, bumper.radius - 2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#1b102c'
    ctx.beginPath()
    ctx.arc(0, 0, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function drawPosts(ctx: CanvasRenderingContext2D): void {
  for (const post of POSTS) {
    const gradient = ctx.createRadialGradient(post.x - 2, post.y - 3, 1, post.x, post.y, post.radius)
    gradient.addColorStop(0, C.white)
    gradient.addColorStop(0.35, C.metal)
    gradient.addColorStop(1, '#20344a')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(post.x, post.y, post.radius, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawSlings(ctx: CanvasRenderingContext2D): void {
  for (const sling of SLINGSHOTS) {
    ctx.save()
    const gradient = ctx.createLinearGradient(sling.points[0].x, sling.points[0].y, sling.points[2].x, sling.points[2].y)
    gradient.addColorStop(0, 'rgba(255,70,92,.28)')
    gradient.addColorStop(1, 'rgba(255,79,163,.7)')
    polygon(ctx, sling.points)
    ctx.fillStyle = gradient
    ctx.shadowColor = C.magenta
    ctx.shadowBlur = 12
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = C.red
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.globalAlpha = .65
    ctx.strokeStyle = C.white
    ctx.lineWidth = 1
    ctx.translate(0, 4)
    polygon(ctx, sling.points)
    ctx.stroke()
    ctx.restore()
  }
}

function drawTargets(ctx: CanvasRenderingContext2D, state: PinballState): void {
  DROP_TARGETS.forEach((target) => {
    const down = state.dropTargets[target.id]
    ctx.save()
    ctx.translate(target.x, target.y)
    ctx.rotate(target.angle ?? 0)
    ctx.shadowColor = down ? 'transparent' : C.green
    ctx.shadowBlur = down ? 0 : 9
    ctx.fillStyle = down ? '#152437' : '#123f3f'
    ctx.strokeStyle = down ? C.dim : C.green
    ctx.lineWidth = 2
    ctx.fillRect(-target.width / 2, -target.height / 2, target.width, down ? 3 : target.height)
    ctx.strokeRect(-target.width / 2, -target.height / 2, target.width, down ? 3 : target.height)
    if (!down) {
      ctx.shadowBlur = 0
      ctx.fillStyle = C.white
      ctx.font = '900 10px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(target.label, 0, 0)
    }
    ctx.restore()
  })
}

function drawInsert(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, lit: boolean, color: string, label: string): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.shadowColor = color
  ctx.shadowBlur = lit ? 16 : 0
  ctx.fillStyle = lit ? color : '#142335'
  ctx.strokeStyle = lit ? C.white : '#35506c'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.fillStyle = lit ? C.ink : '#7a91a8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '900 8px system-ui, sans-serif'
  ctx.fillText(label, 0, 0.5)
  ctx.restore()
}

function drawSensors(ctx: CanvasRenderingContext2D, state: PinballState, now: number): void {
  for (const sensor of SENSORS) {
    if (sensor.kind === 'rollover') {
      drawInsert(ctx, sensor.x, sensor.y, 9, state.rollovers[sensor.id], C.cyan, sensor.label ?? '')
    }
  }

  drawInsert(ctx, 84, 155, 14, state.lockLit, C.green, `${state.lockedBalls}/2`)
  ctx.fillStyle = state.lockLit ? C.green : '#69819b'
  ctx.font = '900 10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('LOCK', 84, 180)

  drawInsert(ctx, 98, 408, 17, state.mode !== null, C.violet, 'MODE')
  drawInsert(ctx, 307, 366, 13, state.spinnerCharge >= 8, C.amber, String(state.spinnerCharge))

  const alpha = 0.55 + Math.sin(now / 200) * 0.2
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = state.multiball ? C.magenta : C.cyan
  ctx.font = '900 11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('↟ ORBIT', 57, 318)
  ctx.fillText('ORBIT ↟', 319, 318)
  ctx.fillText('CORE RAMP', 215, 520)
  ctx.restore()
}

function drawFlipper(ctx: CanvasRenderingContext2D, flipper: FlipperSnapshot): void {
  const gradient = ctx.createLinearGradient(flipper.pivot.x, flipper.pivot.y, flipper.tip.x, flipper.tip.y)
  gradient.addColorStop(0, '#f7fbff')
  gradient.addColorStop(0.22, C.cyan)
  gradient.addColorStop(1, C.blue)
  ctx.save()
  ctx.lineCap = 'round'
  ctx.shadowColor = flipper.active ? C.white : C.blue
  ctx.shadowBlur = flipper.active ? 20 : 9
  ctx.strokeStyle = '#0a1728'
  ctx.lineWidth = flipper.radius * 2 + 7
  ctx.beginPath()
  ctx.moveTo(flipper.pivot.x, flipper.pivot.y)
  ctx.lineTo(flipper.tip.x, flipper.tip.y)
  ctx.stroke()
  ctx.strokeStyle = gradient
  ctx.lineWidth = flipper.radius * 2
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255,255,255,.7)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#10243a'
  ctx.beginPath()
  ctx.arc(flipper.pivot.x, flipper.pivot.y, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawTrails(ctx: CanvasRenderingContext2D, trails: Record<string, TrailPoint[]>): void {
  for (const trail of Object.values(trails)) {
    trail.forEach((point, index) => {
      ctx.fillStyle = `rgba(36,231,255,${point.alpha * (index / Math.max(1, trail.length)) * 0.22})`
      ctx.beginPath()
      ctx.arc(point.x, point.y, 2 + index / trail.length * 2, 0, Math.PI * 2)
      ctx.fill()
    })
  }
}

function drawBall(ctx: CanvasRenderingContext2D, ball: BallSnapshot): void {
  const gradient = ctx.createRadialGradient(ball.x - 3, ball.y - 4, 1, ball.x, ball.y, ball.radius)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(0.3, '#bcecff')
  gradient.addColorStop(0.65, '#7792ae')
  gradient.addColorStop(1, '#162536')
  ctx.save()
  ctx.shadowColor = C.cyan
  ctx.shadowBlur = Math.min(16, 5 + ball.speed / 90)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255,255,255,.8)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

function drawPlunger(ctx: CanvasRenderingContext2D, power: number): void {
  const y = 684 + power * 18
  ctx.save()
  ctx.strokeStyle = C.metal
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(378, y)
  ctx.lineTo(378, 714)
  ctx.stroke()
  ctx.strokeStyle = C.amber
  ctx.lineWidth = 2
  for (let coil = 0; coil < 6; coil += 1) {
    const cy = y + 5 + coil * 4
    ctx.beginPath()
    ctx.moveTo(369 + (coil % 2) * 18, cy)
    ctx.lineTo(387 - (coil % 2) * 18, cy + 3)
    ctx.stroke()
  }
  ctx.restore()
}

function drawEffects(ctx: CanvasRenderingContext2D, effects: VisualEffect[], now: number): void {
  for (const effect of effects) {
    const progress = Math.min(1, (now - effect.startedAt) / effect.duration)
    const alpha = 1 - progress
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = effect.color
    ctx.fillStyle = effect.color
    ctx.shadowColor = effect.color
    ctx.shadowBlur = 12
    if (effect.kind === 'pulse') {
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(effect.x, effect.y, 10 + progress * 32, 0, Math.PI * 2)
      ctx.stroke()
    } else if (effect.kind === 'burst') {
      for (let index = 0; index < 10; index += 1) {
        const angle = index / 10 * Math.PI * 2 + effect.id
        const distance = 8 + progress * 36
        ctx.beginPath()
        ctx.arc(effect.x + Math.cos(angle) * distance, effect.y + Math.sin(angle) * distance, 2.5 * alpha, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (effect.text) {
      ctx.font = '900 13px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(effect.text, effect.x, effect.y - progress * 34)
    }
    ctx.restore()
  }
}

export function renderTable(ctx: CanvasRenderingContext2D, scene: RenderScene): void {
  ctx.clearRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT)
  drawBackdrop(ctx, scene.now)
  drawPlayfieldPlastics(ctx, scene.now)
  drawBrand(ctx)
  drawRamp(ctx, scene.state, scene.now)
  drawRails(ctx)
  drawSensors(ctx, scene.state, scene.now)
  drawSlings(ctx)
  drawTargets(ctx, scene.state)
  drawBumpers(ctx, scene.effects, scene.now)
  drawPosts(ctx)
  drawTrails(ctx, scene.trails)
  scene.flippers.forEach((flipper) => drawFlipper(ctx, flipper))
  scene.balls.forEach((ball) => drawBall(ctx, ball))
  drawPlunger(ctx, scene.plungerPower)
  drawEffects(ctx, scene.effects, scene.now)

  if (scene.state.tilted) {
    ctx.fillStyle = 'rgba(80,0,10,.46)'
    ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT)
    ctx.fillStyle = C.red
    ctx.font = '900 42px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('TILT', TABLE_WIDTH / 2, TABLE_HEIGHT / 2)
  }
}
