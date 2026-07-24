export const PINBALL_WIDTH = 600
export const PINBALL_HEIGHT = 760
export const PINBALL_BALL_RADIUS = 9

export interface PinballControls {
  left: boolean
  right: boolean
}

export interface PinballState {
  ball: { x: number; y: number; vx: number; vy: number }
  score: number
  lives: number
  status: 'ready' | 'playing' | 'over'
}

export const PINBALL_BUMPERS = [
  { x: 190, y: 205, radius: 42, points: 100 },
  { x: 405, y: 205, radius: 42, points: 100 },
  { x: 300, y: 355, radius: 48, points: 250 },
  { x: 155, y: 450, radius: 30, points: 150 },
  { x: 445, y: 450, radius: 30, points: 150 },
] as const

function readyBall() {
  return { x: 548, y: 685, vx: 0, vy: 0 }
}

export function createPinballState(): PinballState {
  return { ball: readyBall(), score: 0, lives: 3, status: 'ready' }
}

export function launchPinball(state: PinballState): PinballState {
  if (state.status !== 'ready') return state
  return { ...state, status: 'playing', ball: { ...state.ball, vx: -105, vy: -710 } }
}

export function stepPinball(state: PinballState, elapsedSeconds: number, controls: PinballControls): PinballState {
  if (state.status !== 'playing') return state
  const dt = Math.min(0.032, Math.max(0, elapsedSeconds))
  const ball = { ...state.ball }
  let score = state.score

  ball.vy += 485 * dt
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  if (ball.x < 27 + PINBALL_BALL_RADIUS) {
    ball.x = 27 + PINBALL_BALL_RADIUS
    ball.vx = Math.abs(ball.vx) * 0.92
  }
  if (ball.x > PINBALL_WIDTH - 27 - PINBALL_BALL_RADIUS) {
    ball.x = PINBALL_WIDTH - 27 - PINBALL_BALL_RADIUS
    ball.vx = -Math.abs(ball.vx) * 0.92
  }
  if (ball.y < 25 + PINBALL_BALL_RADIUS) {
    ball.y = 25 + PINBALL_BALL_RADIUS
    ball.vy = Math.abs(ball.vy) * 0.9
  }

  for (const bumper of PINBALL_BUMPERS) {
    const dx = ball.x - bumper.x
    const dy = ball.y - bumper.y
    const distance = Math.hypot(dx, dy) || 1
    const collisionDistance = bumper.radius + PINBALL_BALL_RADIUS
    if (distance >= collisionDistance) continue
    const nx = dx / distance
    const ny = dy / distance
    ball.x = bumper.x + nx * collisionDistance
    ball.y = bumper.y + ny * collisionDistance
    const incoming = ball.vx * nx + ball.vy * ny
    if (incoming < 0) {
      const impulse = Math.max(420, Math.hypot(ball.vx, ball.vy) * 1.08)
      ball.vx = nx * impulse
      ball.vy = ny * impulse
      score += bumper.points
    }
  }

  const descending = ball.vy > -80
  if (controls.left && descending && ball.x > 95 && ball.x < 305 && ball.y > 605 && ball.y < 690) {
    ball.y = 602
    ball.vx = 210
    ball.vy = -590
    score += 25
  }
  if (controls.right && descending && ball.x > 295 && ball.x < 505 && ball.y > 605 && ball.y < 690) {
    ball.y = 602
    ball.vx = -210
    ball.vy = -590
    score += 25
  }

  if (ball.y > 605 && ball.x < 120) ball.vx = Math.abs(ball.vx) + 85
  if (ball.y > 605 && ball.x > 480) ball.vx = -Math.abs(ball.vx) - 85

  if (ball.y <= PINBALL_HEIGHT + PINBALL_BALL_RADIUS) return { ...state, ball, score }
  const lives = state.lives - 1
  return lives > 0
    ? { ball: readyBall(), score, lives, status: 'ready' }
    : { ball: readyBall(), score, lives: 0, status: 'over' }
}
