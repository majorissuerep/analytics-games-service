/* Classic Pinball cabinet — pure logic.
 *
 * Platform-owned integration glue for the vendored lrusso/Pinball game.
 * This module contains only pure functions so it can be unit-tested with
 * vitest in a plain node environment. The DOM wiring lives in cabinet.js.
 *
 * Upstream purity: files shipped from lrusso/Pinball (PinballGame.htm,
 * PinballGame.js) are never modified; see UPSTREAM.md.
 */

/**
 * Sound preference persisted by the cabinet chrome (localStorage mirror).
 * @type {string}
 */
var CABINET_SOUND_STORAGE_KEY = 'analytics-games.pinball.sound.v1'

/**
 * Cookie used by the upstream game itself for the same preference.
 * The upstream code reads `pinballGAME_SOUND_ENABLED` when it creates a
 * state and flips the `GAME_SOUND_ENABLED` global accordingly, so the
 * cabinet writes this cookie instead of patching upstream.
 * @type {string}
 */
var UPSTREAM_SOUND_COOKIE_NAME = 'pinballGAME_SOUND_ENABLED'

/**
 * Logical upstream playfield size (Phaser game config, in px).
 * @type {{width: number, height: number}}
 */
var UPSTREAM_GAME_SIZE = { width: 320, height: 608 }

/**
 * Cabinet stage bounds requested by the platform manifest: the game must
 * stay usable anywhere between these viewport sizes.
 * @type {{minWidth: number, minHeight: number, maxWidth: number, maxHeight: number}}
 */
var STAGE_BOUNDS = {
  minWidth: 560,
  minHeight: 400,
  maxWidth: 1280,
  maxHeight: 800,
}

/**
 * Clone-friendly plain copy of the stage bounds.
 * @returns {{minWidth: number, minHeight: number, maxWidth: number, maxHeight: number}}
 */
function stageBounds() {
  return {
    minWidth: STAGE_BOUNDS.minWidth,
    minHeight: STAGE_BOUNDS.minHeight,
    maxWidth: STAGE_BOUNDS.maxWidth,
    maxHeight: STAGE_BOUNDS.maxHeight,
  }
}

function clampInt(value, min, max) {
  var n = Math.round(Number(value))
  if (!Number.isFinite(n)) n = min
  return Math.min(max, Math.max(min, n))
}

/**
 * Compute the letterboxed stage size (the area handed to the nested
 * upstream frame) for a cabinet viewport, preserving the upstream aspect
 * ratio.
 *
 * The upstream game renders 320x608 logical pixels and stretches itself to
 * its iframe via Phaser USER_SCALE (innerWidth/innerHeight), so giving the
 * nested frame a correctly sized, aspect-faithful viewport is what makes
 * the table look right without touching upstream.
 *
 * The platform window bounds (560x400 .. 1280x800) anchor a scale clamp:
 * the fit scale is floored at the scale a minimum window yields and capped
 * at the scale a maximum window yields. Inside the bounds the stage exactly
 * fills the viewport (letterboxed); below it the floor keeps the table
 * usable (the stage may overflow and scroll, like any game window smaller
 * than its content); above it the cap keeps the table crisp instead of
 * blowing up the 320x608 backing store.
 *
 * @param {{width: number, height: number}} viewport Cabinet viewport in px.
 * @returns {{
 *   width: number,
 *   height: number,
 *   scale: number,
 *   letterboxX: number,
 *   letterboxY: number,
 *   clampedTo: 'none' | 'min' | 'max',
 * }}
 */
function computeStageSize(viewport) {
  var bounds = STAGE_BOUNDS
  var availableWidth = clampInt(viewport.width, 1, 1000000)
  var availableHeight = clampInt(viewport.height, 1, 1000000)

  var floorScale = Math.min(bounds.minWidth / UPSTREAM_GAME_SIZE.width, bounds.minHeight / UPSTREAM_GAME_SIZE.height)
  var ceilScale = Math.min(bounds.maxWidth / UPSTREAM_GAME_SIZE.width, bounds.maxHeight / UPSTREAM_GAME_SIZE.height)
  var fitScale = Math.min(availableWidth / UPSTREAM_GAME_SIZE.width, availableHeight / UPSTREAM_GAME_SIZE.height)

  var clampedTo = 'none'
  var scale = fitScale
  if (fitScale < floorScale) {
    scale = floorScale
    clampedTo = 'min'
  } else if (fitScale > ceilScale) {
    scale = ceilScale
    clampedTo = 'max'
  }

  var stageWidth = Math.floor(UPSTREAM_GAME_SIZE.width * scale + 1e-6)
  var stageHeight = Math.floor(UPSTREAM_GAME_SIZE.height * scale + 1e-6)

  return {
    width: stageWidth,
    height: stageHeight,
    scale: scale,
    letterboxX: Math.max(0, Math.floor((availableWidth - stageWidth) / 2)),
    letterboxY: Math.max(0, Math.floor((availableHeight - stageHeight) / 2)),
    clampedTo: clampedTo,
  }
}

/**
 * Read a cookie value from `document.cookie` input.
 * @param {string} cookieText Raw `document.cookie` contents.
 * @param {string} name Cookie name.
 * @returns {string | null}
 */
function readCookie(cookieText, name) {
  var prefix = name + '='
  var parts = String(cookieText || '').split(';')
  for (var i = 0; i < parts.length; i += 1) {
    var part = parts[i]
    var trimmed = part.charAt(0) === ' ' ? part.substring(1) : part
    if (trimmed.indexOf(prefix) === 0) return trimmed.substring(prefix.length)
  }
  return null
}

/**
 * Serialize a session cookie assignment for `document.cookie`.
 * @param {string} name Cookie name.
 * @param {string} value Cookie value.
 * @returns {string}
 */
function cookieAssignment(name, value) {
  return name + '=' + value + '; path=/; SameSite=Lax'
}

/**
 * Normalize an unknown stored value into a boolean sound preference.
 * @param {unknown} raw Raw value (JSON-decoded localStorage entry).
 * @returns {boolean | null} `null` when no usable preference exists.
 */
function normalizeSoundPreference(raw) {
  if (typeof raw === 'boolean') return raw
  if (raw === 'true') return true
  if (raw === 'false') return false
  return null
}

/**
 * Interpret the stored cabinet sound preference. localStorage wins; the
 * upstream cookie is the fallback for players who only ever used the
 * in-game toggle.
 * @param {{storage: unknown, cookie: string | null}} sources
 * @returns {boolean | null} Whether sound should be on, or null for default.
 */
function resolveInitialSound(sources) {
  var fromStorage = normalizeSoundPreference(sources.storage)
  if (fromStorage !== null) return fromStorage
  if (sources.cookie !== null) return sources.cookie === 'true'
  return null
}

/**
 * Derive the mute button presentation for a desired sound state.
 * @param {boolean} soundOn
 * @returns {{label: string, icon: string, pressed: boolean, announcement: string}}
 */
function muteButtonState(soundOn) {
  return soundOn
    ? { label: 'SFX on', icon: '🔊', pressed: false, announcement: 'Sound effects on' }
    : { label: 'Muted', icon: '🔇', pressed: true, announcement: 'Sound effects muted' }
}

/**
 * Build the analytics-games bridge v1 exit message (matches
 * packages/game-bridge GameExitMessage with reason "cancel").
 * @returns {{protocol: string, version: number, type: 'game.exit', payload: {reason: 'cancel'}}}
 */
function bridgeExitMessage() {
  return {
    protocol: 'analytics-games.bridge',
    version: 1,
    type: 'game.exit',
    payload: { reason: 'cancel' },
  }
}

export {
  CABINET_SOUND_STORAGE_KEY,
  STAGE_BOUNDS,
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
}
