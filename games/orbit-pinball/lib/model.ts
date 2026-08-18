/**
 * Pinball game state model — pure logic, no rendering.
 *
 * Manages: score, ball count, game phase (ready/plunger/playing/ball-over/game-over),
 * drop targets, spinner, rollover lanes, score multipliers, bonus, and combo.
 */

import type { Vec2, Ball, Collider } from './physics'
import { vec, vdist } from './physics'
import {
  type DropTarget,
  type RolloverLane,
  type Spinner,
  type ScoreZone,
  createDropTargets,
  createRolloverLanes,
  createSpinner,
  createScoreZones,
  ballSpawnPos,
  dropTargetColliders,
} from './table'

export type GamePhase = 'ready' | 'plunger' | 'playing' | 'ball_over' | 'game_over'

export interface PinballState {
  phase: GamePhase
  score: number
  balls: number
  maxBalls: number
  multiplier: number
  combo: number
  /** Timestamp of last bumper hit for combo timing. */
  lastHitTime: number
  dropTargets: DropTarget[]
  rolloverLanes: RolloverLane[]
  spinner: Spinner
  scoreZones: ScoreZone[]
  /** Bonus accumulated during a ball, awarded on ball drain. */
  bonus: number
  /** High score persisted in localStorage. */
  highScore: number
  /** Whether the multiball mode is active. */
  multiball: boolean
  /** Balls remaining in multiball. */
  multiballBalls: number
  /** Message to display (e.g., "BONUS!", "MULTIBALL!", etc.) */
  message: string
  /** Timestamp when message should clear. */
  messageUntil: number
}

export function createInitialState(highScore = 0): PinballState {
  return {
    phase: 'ready',
    score: 0,
    balls: 3,
    maxBalls: 3,
    multiplier: 1,
    combo: 0,
    lastHitTime: 0,
    dropTargets: createDropTargets(),
    rolloverLanes: createRolloverLanes(),
    spinner: createSpinner(),
    scoreZones: createScoreZones(),
    bonus: 0,
    highScore,
    multiball: false,
    multiballBalls: 0,
    message: '',
    messageUntil: 0,
  }
}

export function createBall(): Ball {
  const spawn = ballSpawnPos()
  return {
    pos: { ...spawn },
    vel: vec(0, 0),
    radius: 9,
    alive: true,
  }
}

/**
 * Create a ball launched from the plunger.
 * `power` is 0..1.
 */
export function launchBall(power: number): Vec2 {
  // Launch velocity: upward, slightly left to curve into the playfield
  const maxVel = 1400
  const speed = maxVel * Math.max(0.1, power)
  return vec(-50, -speed)
}

/** Points awarded for each bumper type. */
const BUMPER_POINTS = 100
const SLINGSHOT_POINTS = 50
const FLIPPER_POINTS = 0
const DROP_TARGET_POINTS = 100
const DROP_BANK_BONUS = 500
const SPINNER_POINTS = 25
const ROLLOVER_POINTS = 50

/** Time window for combo (ms). */
const COMBO_WINDOW = 2000

/**
 * Handle a collision event and update state.
 * Returns a new state (immutable update).
 */
export function handleCollision(
  state: PinballState,
  collider: Collider,
  now: number,
): PinballState {
  let { score, combo, multiplier, bonus, lastHitTime, message, messageUntil } = state

  const withinCombo = now - lastHitTime < COMBO_WINDOW
  combo = withinCombo ? combo + 1 : 1
  lastHitTime = now

  // Multiplier increases with combo
  multiplier = Math.min(5, 1 + Math.floor(combo / 3))

  let points = 0
  let isBumper = false

  switch (collider.kind) {
    case 'circle':
      if (collider.bumper) {
        points = BUMPER_POINTS
        isBumper = true
      }
      break
    case 'slingshot':
      points = SLINGSHOT_POINTS
      isBumper = true
      break
    case 'flipper':
      points = FLIPPER_POINTS
      combo = Math.max(0, combo - 1) // hitting flipper doesn't advance combo
      break
    default:
      // Wall hits give no points but don't break combo either
      combo = Math.max(0, combo - 1)
      break
  }

  if (isBumper && combo >= 5) {
    message = `${combo}x COMBO!`
    messageUntil = now + 1500
  }

  const earned = points * multiplier
  score += earned
  bonus += Math.floor(earned * 0.1)

  return {
    ...state,
    score,
    combo,
    multiplier,
    bonus,
    lastHitTime,
    message,
    messageUntil,
  }
}

/**
 * Handle drop target collision. Checks if the ball overlaps any standing target.
 */
export function checkDropTargets(
  state: PinballState,
  ball: Ball,
  now: number,
): { state: PinballState; newColliders: Collider[] } {
  const dropTargets = state.dropTargets.map((t) => ({ ...t }))
  let changed = false
  let bankCleared = false
  let totalPoints = 0

  for (const target of dropTargets) {
    if (target.knockedDown) continue
    // Check if ball overlaps the target rectangle
    const closestX = Math.max(target.pos.x, Math.min(ball.pos.x, target.pos.x + target.width))
    const closestY = Math.max(target.pos.y, Math.min(ball.pos.y, target.pos.y + target.height))
    const dx = ball.pos.x - closestX
    const dy = ball.pos.y - closestY
    if (dx * dx + dy * dy < ball.radius * ball.radius) {
      target.knockedDown = true
      changed = true
      totalPoints += DROP_TARGET_POINTS * state.multiplier
    }
  }

  if (!changed) {
    return { state, newColliders: [] }
  }

  // Check if entire bank is cleared
  if (dropTargets.every((t) => t.knockedDown)) {
    bankCleared = true
    totalPoints += DROP_BANK_BONUS * state.multiplier
  }

  const newColliders = dropTargets.flatMap(dropTargetColliders)

  return {
    state: {
      ...state,
      dropTargets,
      score: state.score + totalPoints,
      bonus: state.bonus + Math.floor(totalPoints * 0.1),
      message: bankCleared ? 'BANK CLEAR!' : 'TARGET DOWN',
      messageUntil: now + 1500,
    },
    newColliders,
  }
}

/**
 * Check rollover lanes. Ball passing over a lane lights it and scores.
 */
export function checkRolloverLanes(
  state: PinballState,
  ball: Ball,
  now: number,
): PinballState {
  let changed = false
  let points = 0
  const rolloverLanes = state.rolloverLanes.map((l) => ({ ...l }))

  for (const lane of rolloverLanes) {
    if (lane.lit) continue
    if (vdist(ball.pos, lane.pos) < lane.radius + ball.radius) {
      lane.lit = true
      changed = true
      points += ROLLOVER_POINTS * state.multiplier
    }
  }

  if (!changed) return state

  // If all lanes lit, reset and give bonus
  if (rolloverLanes.every((l) => l.lit)) {
    points += 300 * state.multiplier
    rolloverLanes.forEach((l) => { l.lit = false })
  }

  return {
    ...state,
    rolloverLanes,
    score: state.score + points,
    message: 'LANE COMPLETE',
    messageUntil: now + 1000,
  }
}

/**
 * Check score zones.
 */
export function checkScoreZones(
  state: PinballState,
  ball: Ball,
  now: number,
): PinballState {
  let points = 0
  let changed = false
  const scoreZones = state.scoreZones.map((z) => ({ ...z }))

  for (const zone of scoreZones) {
    if (now - zone.lastTriggered < zone.cooldownMs) continue
    const closestX = Math.max(zone.pos.x, Math.min(ball.pos.x, zone.pos.x + zone.width))
    const closestY = Math.max(zone.pos.y, Math.min(ball.pos.y, zone.pos.y + zone.height))
    const dx = ball.pos.x - closestX
    const dy = ball.pos.y - closestY
    if (dx * dx + dy * dy < ball.radius * ball.radius) {
      zone.lastTriggered = now
      changed = true
      points += zone.points * state.multiplier
    }
  }

  if (!changed) return state

  return {
    ...state,
    scoreZones,
    score: state.score + points,
  }
}

/**
 * Update spinner. If ball is near and moving fast, spin it.
 */
export function updateSpinner(
  state: PinballState,
  ball: Ball,
  dt: number,
): PinballState {
  const spinner = { ...state.spinner }
  const dist = vdist(ball.pos, spinner.pos)

  // If ball is close and moving, spin
  if (dist < 20 && (Math.abs(ball.vel.x) + Math.abs(ball.vel.y)) > 50) {
    spinner.speed = 20
  }

  // Decay spin
  spinner.speed *= Math.max(0, 1 - 2 * dt)
  spinner.rotation += spinner.speed * dt

  // Count rotations
  const newCount = Math.floor(Math.abs(spinner.rotation) / (Math.PI * 2))
  let points = 0
  if (newCount > spinner.count) {
    const delta = newCount - spinner.count
    spinner.count = newCount
    points = delta * SPINNER_POINTS * state.multiplier
  }

  if (points === 0) return state

  return {
    ...state,
    spinner,
    score: state.score + points,
  }
}

/**
 * Called when a ball drains. Handles ball count decrement, bonus award,
 * and game-over transition.
 */
export function handleBallDrain(state: PinballState, now: number): PinballState {
  if (state.multiball) {
    const remaining = state.multiballBalls - 1
    if (remaining > 0) {
      return {
        ...state,
        multiballBalls: remaining,
        message: `${remaining} BALLS LEFT`,
        messageUntil: now + 1500,
      }
    }
    // Multiball ended
    return {
      ...state,
      multiball: false,
      multiballBalls: 0,
      combo: 0,
      multiplier: 1,
      message: 'MULTIBALL ENDED',
      messageUntil: now + 1500,
    }
  }

  const balls = state.balls - 1
  const bonusEarned = state.bonus * state.multiplier
  const score = state.score + bonusEarned

  if (balls <= 0) {
    const highScore = Math.max(state.highScore, score)
    return {
      ...state,
      balls: 0,
      score,
      bonus: 0,
      phase: 'game_over',
      combo: 0,
      multiplier: 1,
      highScore,
      message: 'GAME OVER',
      messageUntil: now + 3000,
    }
  }

  return {
    ...state,
    balls,
    score,
    bonus: 0,
    phase: 'plunger',
    combo: 0,
    multiplier: 1,
    message: `BALL ${state.maxBalls - balls + 1}`,
    messageUntil: now + 1500,
  }
}

/**
 * Start a new game.
 */
export function startGame(state: PinballState): PinballState {
  const fresh = createInitialState(state.highScore)
  return { ...fresh, phase: 'plunger' }
}

/**
 * Check if all drop targets are down and should reset.
 */
export function maybeResetDropTargets(state: PinballState, now: number): PinballState {
  if (state.dropTargets.every((t) => t.knockedDown)) {
    return {
      ...state,
      dropTargets: createDropTargets(),
      message: 'TARGETS RESET',
      messageUntil: now + 1000,
    }
  }
  return state
}

/**
 * Trigger multiball (e.g., when all drop targets are cleared twice).
 */
export function triggerMultiball(state: PinballState, now: number): PinballState {
  if (state.multiball) return state
  return {
    ...state,
    multiball: true,
    multiballBalls: 2,
    message: 'MULTIBALL!',
    messageUntil: now + 2000,
  }
}

/**
 * Get the dynamic colliders for the current state (drop targets change).
 */
export function getDynamicColliders(state: PinballState): Collider[] {
  return state.dropTargets.flatMap(dropTargetColliders)
}
