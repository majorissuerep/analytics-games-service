/* Classic Pinball cabinet — DOM bootstrap.
 *
 * Wires the pure helpers in cabinet-core.js to the cabinet chrome:
 * letterboxed scaling, branded loader, persistent mute, and the
 * game-bridge exit channel. Loaded as an ES module (see cabinet.html);
 * module scripts execute after the document is parsed, so the DOM is
 * ready without extra waiting.
 *
 * Upstream purity: PinballGame.htm / PinballGame.js are never modified;
 * this script only reaches into the nested frame at runtime (same-origin)
 * to reflect the persisted sound preference onto the upstream globals.
 */
import {
  CABINET_SOUND_STORAGE_KEY,
  UPSTREAM_SOUND_COOKIE_NAME,
  bridgeExitMessage,
  computeStageSize,
  cookieAssignment,
  muteButtonState,
  normalizeSoundPreference,
  readCookie,
  resolveInitialSound,
} from './cabinet-core.js'

  var elements = {
    bar: document.querySelector('[data-pinball-bar]'),
    stage: document.querySelector('[data-pinball-stage]'),
    gameFrame: document.querySelector('[data-pinball-game]'),
    loader: document.querySelector('[data-pinball-loader]'),
    loaderText: document.querySelector('[data-pinball-loader-text]'),
    loaderHint: document.querySelector('[data-pinball-loader-hint]'),
    mute: document.querySelector('[data-pinball-mute]'),
    muteLabel: document.querySelector('[data-pinball-mute-label]'),
    muteIcon: document.querySelector('[data-pinball-mute] .pinball-bar-icon'),
    exit: document.querySelector('[data-pinball-exit]'),
  }

  var state = {
    loaded: false,
    broken: false,
    soundOn: true,
    stageWidth: 0,
    stageHeight: 0,
    loadTimer: 0,
    gameBecameVisible: false,
    audioProbeTimer: 0,
    audioProbeAttempts: 0,
    initialSoundApplied: false,
    syncSound: function () {},
  }

  function isGameFrameEvent(event) {
    return event.source === elements.gameFrame.contentWindow
  }

  /* --- Exit ------------------------------------------------------------ */

  function postExit() {
    var target = window.parent
    if (target === window) return
    target.postMessage(bridgeExitMessage(), window.location.origin)
  }

  /* --- Loader ---------------------------------------------------------- */

  var startedAt = Date.now()
  var elapsedTimer = window.setInterval(function () {
    document.querySelector('[data-load-elapsed]').textContent = Math.floor((Date.now() - startedAt) / 1000) + 's'
  }, 1000)
  var readyProbe = window.setInterval(markLoaded, 100)
  var failureTimer = window.setTimeout(markBroken, 45000)
  document.querySelector('[data-load-retry]').addEventListener('click', function () { window.location.reload() })

  function stopLoading() {
    window.clearInterval(readyProbe)
    window.clearInterval(elapsedTimer)
    window.clearTimeout(failureTimer)
  }

  function markLoaded() {
    if (state.loaded) return
    // The legacy bridge fires on document load. Verify the actual Phaser
    // scene as asset loading can continue after that event.
    var nested = nestedWindow()
    if (!nested || !nested.game || !nested.game.state || !['Pinball.Splash', 'Pinball.Menu', 'Pinball.Game'].includes(nested.game.state.current)) return
    state.loaded = true
    stopLoading()
    window.clearTimeout(state.loadTimer)
    elements.loader.classList.add('is-loaded')
  }

  function markBroken() {
    if (state.broken) return
    elements.loader.setAttribute('role', 'alert')
    state.broken = true
    stopLoading()
    elements.loader.querySelector('[role="progressbar"]').hidden = true
    document.querySelector('[data-load-retry]').hidden = false
    window.clearTimeout(state.loadTimer)
    elements.loader.classList.add('is-broken')
    elements.loaderText.textContent = 'Pinball could not be loaded'
    if (elements.loaderHint) {
      elements.loaderHint.hidden = false
      elements.loaderHint.textContent = 'Retry loading or use Exit to return to the desktop.'
    }
  }

  /* --- Sound ----------------------------------------------------------- */

  function desiredSoundOn() {
    var stored = null
    try {
      stored = normalizeSoundPreference(JSON.parse(window.localStorage.getItem(CABINET_SOUND_STORAGE_KEY)))
    } catch (error) {
      stored = null
    }
    var resolved = resolveInitialSound({
      storage: stored,
      cookie: readCookie(document.cookie, UPSTREAM_SOUND_COOKIE_NAME),
    })
    return resolved === null ? true : resolved
  }

  function persistSound(soundOn) {
    try {
      window.localStorage.setItem(CABINET_SOUND_STORAGE_KEY, JSON.stringify(soundOn))
    } catch (error) {
      /* Private-mode fallback: the cookie write below still applies. */
    }
    document.cookie = cookieAssignment(UPSTREAM_SOUND_COOKIE_NAME, String(soundOn))
  }

  function nestedWindow() {
    var nested = elements.gameFrame.contentWindow
    return nested && !nested.closed ? nested : null
  }

  function applySoundToUpstream(soundOn) {
    var nested = nestedWindow()
    if (!nested) return false
    var applied = false
    try {
      /* Reflect the preference onto the upstream globals. The upstream
       * script checks `GAME_SOUND_ENABLED` before every play call, and
       * Phaser's global sound manager mutes the whole scene. */
      nested.GAME_SOUND_ENABLED = soundOn
      applied = true
      if (nested.game && nested.game.sound) {
        nested.game.sound.mute = !soundOn
      }
    } catch (error) {
      applied = false
    }
    return applied
  }

  function applySound(soundOn) {
    state.soundOn = soundOn
    var presentation = muteButtonState(soundOn)
    elements.mute.setAttribute('aria-pressed', presentation.pressed ? 'true' : 'false')
    elements.mute.setAttribute('aria-label', presentation.announcement)
    if (elements.muteLabel) elements.muteLabel.textContent = presentation.label
    if (elements.muteIcon) elements.muteIcon.textContent = presentation.icon
    applySoundToUpstream(soundOn)
  }

  function audioProbeTick() {
    if (state.initialSoundApplied) return
    if (applySoundToUpstream(state.soundOn)) {
      state.initialSoundApplied = true
      return
    }
    state.audioProbeAttempts += 1
    if (state.audioProbeAttempts >= 100) state.initialSoundApplied = true
  }

  /* --- Scaling ---------------------------------------------------------- */

  function stageViewport() {
    var rect = elements.stage.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }

  function resize() {
    var next = computeStageSize(stageViewport())
    if (next.width === state.stageWidth && next.height === state.stageHeight) return
    var firstSizing = state.stageWidth === 0
    state.stageWidth = next.width
    state.stageHeight = next.height
    elements.gameFrame.style.width = next.width + 'px'
    elements.gameFrame.style.height = next.height + 'px'
    if (firstSizing) return
    /* A nested reload keeps the upstream Phaser scale manager in sync when
     * the viewport it measures (its own window) changes size. The first
     * sizing happens before the nested document finishes navigating, so
     * there is nothing to reload yet. */
    elements.gameFrame.src = 'PinballGame.htm'
  }

  /* --- Bootstrap -------------------------------------------------------- */

  function init() {
    state.soundOn = desiredSoundOn()

    elements.mute.addEventListener('click', function () {
      var next = !state.soundOn
      persistSound(next)
      applySound(next)
    })

    elements.exit.addEventListener('click', postExit)

    window.addEventListener('message', function (event) {
      if (event.origin !== window.location.origin) return
      if (!isGameFrameEvent(event)) return
      /* Loader handoff: PinballGame.htm pings "pinball:menu-ready" from its
       * boot state once the menu scene is actually visible. */
      if (event.data === 'pinball:menu-ready') {
        markLoaded()
        return
      }
      /* The upstream game flips GAME_SOUND_ENABLED and persists the cookie
       * when its own toggle is used; mirror that into the cabinet state. */
      if (event.data === true) applySound(true)
      if (event.data === false) applySound(false)
    })

    elements.gameFrame.addEventListener('load', function () {
      if (state.gameBecameVisible) {
        /* Resize reload: keep the loader hidden and re-sync sound. */
        applySound(state.soundOn)
        state.initialSoundApplied = false
        state.audioProbeAttempts = 0
        return
      }
      state.gameBecameVisible = true
      applySound(state.soundOn)
      state.audioProbeTimer = window.setInterval(audioProbeTick, 300)
      // Wait for the actual menu-ready bridge event; document load alone
      // does not mean Phaser has finished loading the game assets.
    })

    /* The nested document can also report a hard failure via the loader. */
    elements.gameFrame.addEventListener('error', markBroken)

    state.loadTimer = window.setTimeout(function () {
      if (!state.loaded) {
        if (elements.loaderHint) elements.loaderHint.hidden = false
        if (elements.loaderText) elements.loaderText.textContent = 'Still loading Classic Pinball…'
      }
    }, 8000)

    applySound(state.soundOn)
    window.addEventListener('resize', resize)
    resize()
    // Cabinet controls are ready independently of the nested game download.
    document.documentElement.dataset.appReady = 'true'
    if (window.parent !== window) window.parent.postMessage({ protocol: 'analytics-games.bridge', version: 1, type: 'game.ready' }, window.location.origin)
  }

  init()

// Exposed for ad-hoc debugging in devtools.
window.PinballCabinet = {
  markLoaded: markLoaded,
  applySound: applySound,
}
