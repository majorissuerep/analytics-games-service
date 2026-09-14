/* Unit tests for the Classic Pinball cabinet pure logic.
 *
 * The module under test lives in public/vendor/pinball/ next to the vendored
 * game (it is the runtime for cabinet.html), but the vendor directory is
 * excluded from lint/typecheck globs, so the tests live here where the
 * repository's quality gates can see them.
 */
import { describe, expect, it } from 'vitest'
import {
  CABINET_SOUND_STORAGE_KEY,
  UPSTREAM_GAME_SIZE,
  UPSTREAM_SOUND_COOKIE_NAME,
  bridgeExitMessage,
  clampInt,
  cookieAssignment,
  computeStageSize,
  muteButtonState,
  normalizeSoundPreference,
  readCookie,
  resolveInitialSound,
  stageBounds,
} from '../../public/vendor/pinball/cabinet-core.js'

describe('computeStageSize', () => {
  it('fills an in-bounds viewport exactly when it drives the scale', () => {
    // Height-driven scale 760/608 = 1.25: between floor and ceiling.
    const stage = computeStageSize({ width: 1280, height: 760 })
    expect(stage.width).toBe(400) // floor(320 * 1.25)
    expect(stage.height).toBe(760)
    expect(stage.scale).toBe(1.25)
    expect(stage.letterboxX).toBe(440) // floor((1280 - 400) / 2)
    expect(stage.letterboxY).toBe(0)
    expect(stage.clampedTo).toBe('none')
  })

  it('letterboxes a wider-than-ratio desktop window horizontally', () => {
    // Realistic maximized desktop stage area: 900x662 is height-constrained.
    const stage = computeStageSize({ width: 900, height: 662 })
    expect(stage.height).toBe(662)
    expect(stage.width).toBe(348) // floor(320 * 662/608)
    expect(stage.letterboxX).toBe(276) // floor((900 - 348) / 2)
    expect(stage.letterboxY).toBe(0)
    expect(stage.clampedTo).toBe('none')
  })

  it('caps the scale when a narrow window demands more than the ceiling allows', () => {
    // 430/320 = 1.34 exceeds the 1280x800 ceiling (1.3158).
    const stage = computeStageSize({ width: 430, height: 900 })
    expect(stage.clampedTo).toBe('max')
    expect(stage.width).toBe(421)
    expect(stage.height).toBe(800)
    expect(stage.letterboxX).toBe(4) // floor((430 - 421) / 2)
    expect(stage.letterboxY).toBe(50) // floor((900 - 800) / 2)
  })

  it('floors the scale below the minimum window so the table stays usable', () => {
    const stage = computeStageSize({ width: 400, height: 300 })
    const floorScale = Math.min(560 / 320, 400 / 608)
    expect(stage.clampedTo).toBe('min')
    expect(stage.scale).toBe(floorScale)
    expect(stage.width).toBe(210) // floor(320 * floorScale)
    expect(stage.height).toBe(400) // 608 * (400/608), epsilon-stable
    expect(stage.letterboxX).toBe(95) // floor((400 - 210) / 2)
    expect(stage.letterboxY).toBe(0) // overflow scrolls, never negative
  })

  it('caps the scale above the maximum window instead of blowing up the 320x608 backing store', () => {
    const stage = computeStageSize({ width: 2400, height: 1600 })
    const ceilScale = Math.min(1280 / 320, 800 / 608)
    expect(stage.clampedTo).toBe('max')
    expect(stage.scale).toBe(ceilScale)
    expect(stage.width).toBe(421) // floor(320 * ceilScale)
    expect(stage.height).toBe(800)
    expect(stage.letterboxX).toBe(989) // floor((2400 - 421) / 2)
    expect(stage.letterboxY).toBe(400)
  })

  it('preserves the upstream aspect ratio across in-bound viewports', () => {
    const ratio = UPSTREAM_GAME_SIZE.width / UPSTREAM_GAME_SIZE.height
    for (const viewport of [
      { width: 560, height: 800 },
      { width: 720, height: 640 },
      { width: 1280, height: 800 },
      { width: 900, height: 812 },
    ]) {
      const stage = computeStageSize(viewport)
      expect(stage.width / stage.height).toBeCloseTo(ratio, 2)
    }
  })

  it('never produces NaN or negative geometry from degenerate viewports', () => {
    for (const viewport of [{ width: 0, height: 0 }, { width: -50, height: -10 }, { width: 0.4, height: 0.2 }]) {
      const stage = computeStageSize(viewport)
      expect(Number.isFinite(stage.width)).toBe(true)
      expect(Number.isFinite(stage.height)).toBe(true)
      expect(Number.isFinite(stage.scale)).toBe(true)
      expect(stage.width).toBeGreaterThan(0)
      expect(stage.height).toBeGreaterThan(0)
      expect(stage.letterboxX).toBeGreaterThanOrEqual(0)
      expect(stage.letterboxY).toBeGreaterThanOrEqual(0)
      expect(stage.clampedTo).toBe('min')
    }
  })
})

describe('cookie helpers', () => {
  it('reads the upstream sound cookie', () => {
    expect(readCookie('pinballGAME_SOUND_ENABLED=false; other=1', 'pinballGAME_SOUND_ENABLED')).toBe('false')
    expect(readCookie('a=b; pinballGAME_SOUND_ENABLED=true', 'pinballGAME_SOUND_ENABLED')).toBe('true')
  })

  it('returns null for missing cookies and handles whitespace and prefix collisions', () => {
    expect(readCookie('', 'pinballGAME_SOUND_ENABLED')).toBeNull()
    expect(readCookie('other=1', 'pinballGAME_SOUND_ENABLED')).toBeNull()
    expect(readCookie(' pinballGAME_SOUND_ENABLED=false', 'pinballGAME_SOUND_ENABLED')).toBe('false')
    // Must not match a longer cookie that merely shares the prefix.
    expect(readCookie('pinballGAME_SOUND_ENABLED_EXTRA=true', 'pinballGAME_SOUND_ENABLED')).toBeNull()
  })

  it('serializes a session cookie scoped to the site path', () => {
    expect(cookieAssignment(UPSTREAM_SOUND_COOKIE_NAME, 'true')).toBe(
      'pinballGAME_SOUND_ENABLED=true; path=/; SameSite=Lax',
    )
  })
})

describe('sound preference resolution', () => {
  it('normalizes known truthy and falsy shapes and rejects junk', () => {
    expect(normalizeSoundPreference(true)).toBe(true)
    expect(normalizeSoundPreference(false)).toBe(false)
    expect(normalizeSoundPreference('true')).toBe(true)
    expect(normalizeSoundPreference('false')).toBe(false)
    expect(normalizeSoundPreference(null)).toBeNull()
    expect(normalizeSoundPreference(undefined)).toBeNull()
    expect(normalizeSoundPreference('yes')).toBeNull()
    expect(normalizeSoundPreference(1)).toBeNull()
  })

  it('prefers the cabinet localStorage mirror over the upstream cookie', () => {
    expect(resolveInitialSound({ storage: false, cookie: 'true' })).toBe(false)
    expect(resolveInitialSound({ storage: true, cookie: 'false' })).toBe(true)
  })

  it('falls back to the upstream cookie for players who only used the in-game toggle', () => {
    expect(resolveInitialSound({ storage: null, cookie: 'false' })).toBe(false)
    expect(resolveInitialSound({ storage: 'junk', cookie: 'true' })).toBe(true)
  })

  it('defaults to sound on when no preference exists anywhere', () => {
    expect(resolveInitialSound({ storage: null, cookie: null })).toBeNull()
  })
})

describe('mute button presentation', () => {
  it('renders unmuted state', () => {
    const state = muteButtonState(true)
    expect(state.pressed).toBe(false)
    expect(state.label).toBe('SFX on')
    expect(state.icon).toBe('🔊')
    expect(state.announcement).toBe('Sound effects on')
  })

  it('renders muted state', () => {
    const state = muteButtonState(false)
    expect(state.pressed).toBe(true)
    expect(state.label).toBe('Muted')
    expect(state.icon).toBe('🔇')
    expect(state.announcement).toBe('Sound effects muted')
  })
})

describe('bridge exit message', () => {
  it('matches the game-bridge v1 GameExitMessage shape with reason cancel', () => {
    expect(bridgeExitMessage()).toEqual({
      protocol: 'analytics-games.bridge',
      version: 1,
      type: 'game.exit',
      payload: { reason: 'cancel' },
    })
  })
})

describe('constants', () => {
  it('exposes the platform stage bounds and storage key', () => {
    expect(stageBounds()).toEqual({ minWidth: 560, minHeight: 400, maxWidth: 1280, maxHeight: 800 })
    expect(CABINET_SOUND_STORAGE_KEY).toBe('analytics-games.pinball.sound.v1')
    expect(UPSTREAM_SOUND_COOKIE_NAME).toBe('pinballGAME_SOUND_ENABLED')
    expect(UPSTREAM_GAME_SIZE).toEqual({ width: 320, height: 608 })
  })

  it('returns stage bounds as a copy', () => {
    const bounds = stageBounds()
    bounds.minWidth = 1
    expect(stageBounds().minWidth).toBe(560)
  })
})

describe('clampInt', () => {
  it('clamps and rounds', () => {
    expect(clampInt(5, 1, 10)).toBe(5)
    expect(clampInt(0.4, 1, 10)).toBe(1)
    expect(clampInt(12.6, 1, 10)).toBe(10)
    expect(clampInt(4.5, 1, 10)).toBe(5)
    expect(clampInt(Number.NaN, 1, 10)).toBe(1)
  })
})
