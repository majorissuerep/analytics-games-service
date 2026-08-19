import type { PhysicsEvent } from './physics'
import { BALL_SAVE_MS, rolloverIds, targetIds } from './table'

export type GamePhase = 'attract' | 'plunger' | 'playing' | 'ball-over' | 'game-over'
export type ModeName = 'reactor-rush' | null

export interface PinballState {
  phase: GamePhase
  score: number
  ballsRemaining: number
  ballNumber: number
  bonus: number
  multiplier: number
  combo: number
  comboExpiresAt: number
  dropTargets: Record<string, boolean>
  rollovers: Record<string, boolean>
  lockLit: boolean
  lockedBalls: number
  multiball: boolean
  jackpotValue: number
  jackpots: number
  spinnerCharge: number
  mode: ModeName
  modeEndsAt: number
  ballSaveUntil: number
  nudgeTimes: number[]
  tilted: boolean
  message: string
  messageUntil: number
  lastShot: string | null
}

export type RuleEffect =
  | { type: 'target-down'; id: string }
  | { type: 'reset-targets' }
  | { type: 'capture-ball'; ballId: string }
  | { type: 'serve-ball' }
  | { type: 'spawn-multiball'; count: number }

export interface RuleUpdate {
  state: PinballState
  effects: RuleEffect[]
  points: number
}

function flagRecord(ids: string[]): Record<string, boolean> {
  return Object.fromEntries(ids.map((id) => [id, false]))
}

export function createInitialState(): PinballState {
  return {
    phase: 'attract',
    score: 0,
    ballsRemaining: 3,
    ballNumber: 1,
    bonus: 0,
    multiplier: 1,
    combo: 0,
    comboExpiresAt: 0,
    dropTargets: flagRecord(targetIds()),
    rollovers: flagRecord(rolloverIds()),
    lockLit: false,
    lockedBalls: 0,
    multiball: false,
    jackpotValue: 50_000,
    jackpots: 0,
    spinnerCharge: 0,
    mode: null,
    modeEndsAt: 0,
    ballSaveUntil: 0,
    nudgeTimes: [],
    tilted: false,
    message: 'PRESS START',
    messageUntil: Number.POSITIVE_INFINITY,
    lastShot: null,
  }
}

export function startGame(now: number): PinballState {
  return {
    ...createInitialState(),
    phase: 'plunger',
    message: 'CHARGE PLUNGER',
    messageUntil: now + 8_000,
  }
}

export function launchBall(state: PinballState, now: number): PinballState {
  if (state.phase !== 'plunger') return state
  return {
    ...state,
    phase: 'playing',
    ballSaveUntil: now + BALL_SAVE_MS,
    message: 'BALL SAVE LIT',
    messageUntil: now + 2_000,
  }
}

function withMessage(state: PinballState, message: string, now: number, duration = 1_600): PinballState {
  return { ...state, message, messageUntil: now + duration }
}

function addScore(state: PinballState, base: number, now: number, shot: string, comboEligible = true): { state: PinballState; points: number } {
  const activeModeFactor = state.mode === 'reactor-rush' && now < state.modeEndsAt ? 2 : 1
  const combo = comboEligible && now <= state.comboExpiresAt ? Math.min(5, state.combo + 1) : comboEligible ? 1 : state.combo
  const comboFactor = comboEligible ? combo : 1
  const points = Math.round(base * state.multiplier * activeModeFactor * comboFactor)
  return {
    points,
    state: {
      ...state,
      score: state.score + points,
      bonus: state.bonus + Math.round(base * 0.1),
      combo,
      comboExpiresAt: comboEligible ? now + 2_400 : state.comboExpiresAt,
      lastShot: shot,
    },
  }
}

export function handlePhysicsEvent(current: PinballState, event: PhysicsEvent, now: number): RuleUpdate {
  if (current.phase !== 'playing' || current.tilted || event.kind === 'drain') {
    return { state: current, effects: [], points: 0 }
  }

  let state = current
  let points = 0
  const effects: RuleEffect[] = []
  const award = (base: number, label: string, comboEligible = true) => {
    const scored = addScore(state, base, now, label, comboEligible)
    state = scored.state
    points += scored.points
  }

  switch (event.kind) {
    case 'bumper':
      award(500, 'POP BUMPER')
      if (state.combo >= 4) state = withMessage(state, `${state.combo}× COMBO`, now, 900)
      break
    case 'sling':
      award(175, 'SLINGSHOT')
      break
    case 'target': {
      if (state.dropTargets[event.elementId]) break
      award(1_250, 'FORGE TARGET')
      const dropTargets = { ...state.dropTargets, [event.elementId]: true }
      state = { ...state, dropTargets }
      effects.push({ type: 'target-down', id: event.elementId })
      if (Object.values(dropTargets).every(Boolean)) {
        award(15_000, 'FORGE COMPLETE', false)
        state = withMessage({ ...state, lockLit: true }, 'BALL LOCK LIT', now, 2_500)
      }
      break
    }
    case 'rollover': {
      if (state.rollovers[event.elementId]) break
      award(800, 'N·E·O·N LANE', false)
      const rollovers = { ...state.rollovers, [event.elementId]: true }
      state = { ...state, rollovers }
      if (Object.values(rollovers).every(Boolean)) {
        const multiplier = Math.min(5, state.multiplier + 1)
        award(8_000, 'NEON COMPLETE', false)
        state = withMessage({ ...state, multiplier, rollovers: flagRecord(rolloverIds()) }, `${multiplier}× PLAYFIELD`, now, 2_200)
      }
      break
    }
    case 'spinner':
      award(350, 'TURBINE')
      state = { ...state, spinnerCharge: Math.min(12, state.spinnerCharge + 1) }
      if (state.spinnerCharge === 12) state = withMessage(state, 'REACTOR CHARGED', now)
      break
    case 'orbit':
      // Only named entry sensors represent a completed orbit shot.
      if (!event.elementId.endsWith('orbit')) break
      award(3_500, event.elementId === 'left-orbit' ? 'LEFT ORBIT' : 'RIGHT ORBIT')
      break
    case 'ramp': {
      const cashout = 5_000 + state.spinnerCharge * 1_000
      award(cashout, 'REACTOR RAMP')
      state = withMessage({ ...state, spinnerCharge: 0 }, state.spinnerCharge >= 8 ? 'TURBINE CASHOUT' : 'RAMP MADE', now)
      break
    }
    case 'scoop':
      award(4_000, 'CONTROL SCOOP')
      state = withMessage({ ...state, mode: 'reactor-rush', modeEndsAt: now + 30_000 }, 'REACTOR RUSH · 2× SCORING', now, 2_800)
      break
    case 'lock':
      if (!state.lockLit || state.multiball) {
        award(2_000, 'LOCK LANE')
        break
      }
      effects.push({ type: 'capture-ball', ballId: event.ballId })
      if (state.lockedBalls === 0) {
        state = withMessage({ ...state, lockedBalls: 1, lockLit: false, phase: 'plunger' }, 'BALL 1 LOCKED', now, 2_400)
        effects.push({ type: 'reset-targets' }, { type: 'serve-ball' })
        state = { ...state, dropTargets: flagRecord(targetIds()) }
      } else {
        state = withMessage({
          ...state,
          lockedBalls: 0,
          lockLit: false,
          multiball: true,
          jackpotValue: 50_000,
          dropTargets: flagRecord(targetIds()),
        }, 'MULTIBALL · JACKPOT LIT', now, 3_000)
        effects.push({ type: 'reset-targets' }, { type: 'spawn-multiball', count: 3 })
      }
      break
    case 'jackpot':
      if (state.multiball) {
        award(state.jackpotValue, 'JACKPOT', false)
        state = withMessage({
          ...state,
          jackpots: state.jackpots + 1,
          jackpotValue: Math.min(250_000, state.jackpotValue + 25_000),
        }, `JACKPOT ${state.jackpotValue.toLocaleString()}`, now, 2_500)
      }
      break
    case 'inlane':
      award(1_000, 'RETURN LANE')
      break
    case 'outlane':
      award(500, 'OUTLANE', false)
      break
  }

  return { state, effects, points }
}

export function handleDrain(current: PinballState, now: number, ballsStillInPlay: number): RuleUpdate {
  if (ballsStillInPlay > 0) {
    const multiball = ballsStillInPlay > 1
    const state = current.multiball && !multiball
      ? withMessage({ ...current, multiball: false }, 'MULTIBALL ENDED', now)
      : current
    return { state, effects: [], points: 0 }
  }

  if (!current.tilted && now <= current.ballSaveUntil) {
    return {
      state: withMessage({ ...current, phase: 'plunger', ballSaveUntil: 0 }, 'BALL SAVED', now, 2_200),
      effects: [{ type: 'serve-ball' }],
      points: 0,
    }
  }

  const bonusPoints = current.tilted ? 0 : current.bonus * current.multiplier
  const ballsRemaining = current.ballsRemaining - 1
  if (ballsRemaining <= 0) {
    return {
      state: withMessage({
        ...current,
        phase: 'game-over',
        score: current.score + bonusPoints,
        ballsRemaining: 0,
        bonus: 0,
        multiball: false,
      }, 'GAME OVER', now, Number.POSITIVE_INFINITY),
      effects: [],
      points: bonusPoints,
    }
  }

  return {
    state: withMessage({
      ...current,
      phase: 'ball-over',
      score: current.score + bonusPoints,
      ballsRemaining,
      ballNumber: current.ballNumber + 1,
      bonus: 0,
      multiball: false,
      tilted: false,
      nudgeTimes: [],
      combo: 0,
      ballSaveUntil: 0,
    }, current.tilted ? 'TILT · BONUS FORFEIT' : `BONUS ${bonusPoints.toLocaleString()}`, now, 2_000),
    effects: [],
    points: bonusPoints,
  }
}

export function serveNextBall(state: PinballState, now: number): RuleUpdate {
  if (state.phase !== 'ball-over') return { state, effects: [], points: 0 }
  return {
    state: withMessage({ ...state, phase: 'plunger' }, `BALL ${state.ballNumber}`, now, 1_500),
    effects: [{ type: 'serve-ball' }],
    points: 0,
  }
}

export function registerNudge(state: PinballState, now: number): PinballState {
  if (state.phase !== 'playing' || state.tilted) return state
  const nudgeTimes = [...state.nudgeTimes.filter((time) => now - time < 3_000), now]
  if (nudgeTimes.length >= 3) {
    return withMessage({ ...state, nudgeTimes, tilted: true, combo: 0, ballSaveUntil: 0 }, 'TILT · FLIPPERS DISABLED', now, 4_000)
  }
  return withMessage({ ...state, nudgeTimes }, nudgeTimes.length === 2 ? 'DANGER' : 'NUDGE', now, 900)
}

export function tickState(state: PinballState, now: number): PinballState {
  let next = state
  if (next.combo > 0 && now > next.comboExpiresAt) next = { ...next, combo: 0 }
  if (next.mode && now >= next.modeEndsAt) next = withMessage({ ...next, mode: null, modeEndsAt: 0 }, 'REACTOR RUSH COMPLETE', now)
  if (next.message && now > next.messageUntil) {
    next = { ...next, message: objectiveFor(next), messageUntil: Number.POSITIVE_INFINITY }
  }
  return next
}

export function objectiveFor(state: PinballState): string {
  if (state.tilted) return 'TILT'
  if (state.multiball) return `SHOOT CORE FOR ${state.jackpotValue.toLocaleString()}`
  if (state.lockLit) return state.lockedBalls > 0 ? 'LOCK BALL 2' : 'SHOOT LOCK'
  if (state.mode) return 'REACTOR RUSH · ALL SCORING 2×'
  if (state.spinnerCharge >= 8) return 'SHOOT RAMP · CASH OUT TURBINE'
  return 'COMPLETE F·O·R·G·E TO LIGHT LOCK'
}
