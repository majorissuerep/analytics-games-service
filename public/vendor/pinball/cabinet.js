// Platform-owned cabinet. The MIT engine runtime is isolated in /vendor/space-cadet.
const $ = id => document.getElementById(id)
const canvas = $('canvas')
const ASSETS = '/vendor/space-cadet/'
const KEY = 'analytics-games.pinball.sound.v2'
let ready = false
let engineArmed = false
let paused = false
let soundOn = false
let started = Date.now()
let timeout
let timer
let feedingStarted = 0
let lastRuntimeError = ''
try { soundOn = localStorage.getItem(KEY) === 'true' } catch { /* Browser storage is optional. */ }

function announce(message, error = false) { $('notice').textContent = message; $('notice').classList.toggle('error', error) }
function key(type, key, code, keyCode, focusTable = true) {
  if (focusTable) canvas.focus({ preventScroll: true })
  window.Module?._cabinet_key?.(keyCode, type === 'keydown' ? 1 : 0)
}
function press(name, code, number) { key('keydown', name, code, number); key('keyup', name, code, number) }
let audioBound = false
function applySound() {
  const audio = window.Module?.SDL2?.audioContext
  if (!audio) return
  if (!audioBound) { audioBound = true; audio.addEventListener('statechange', () => { if (!soundOn && audio.state === 'running') void audio.suspend() }) }
  if (soundOn) void audio.resume().catch(() => announce('Your browser needs a click on the table to enable audio.'))
  else void audio.suspend()
}
function toggleSound() { soundOn = !soundOn; applySound(); soundLabel(); try { localStorage.setItem(KEY, String(soundOn)) } catch { /* Optional persistence. */ } }
function soundLabel() { $('sound').setAttribute('aria-label', soundOn ? 'Sound on' : 'Sound off'); $('sound').setAttribute('aria-pressed', String(soundOn)) }
function fit() {
  if (!canvas.width || !canvas.height) return
  const stage = canvas.parentElement
  const width = Math.min(stage.clientWidth, stage.clientHeight * 365 / 470)
  canvas.style.width = `${width}px`; canvas.style.height = `${width * 470 / 365}px`
}
new ResizeObserver(fit).observe(canvas.parentElement)
function stopTimer() { clearInterval(timer); clearTimeout(timeout) }
function fail(message) {
  stopTimer(); ready = false
  $('loader').hidden = false; $('progress').hidden = true; $('retry').hidden = false
  $('loading-label').textContent = 'Space Cadet could not start'
  $('loading-detail').textContent = message
  $('loading-label').parentElement.setAttribute('role', 'alert')
  for (const id of ['new-game','pause','sound']) $(id).disabled = true
  for (const button of document.querySelectorAll('[data-key]')) button.disabled = true
}
function begin() {
  started = Date.now(); ready = false
  canvas.hidden = false; canvas.width = 365; canvas.height = 470; fit()
  $('loader').hidden = false; $('progress').hidden = false; $('retry').hidden = true
  timer = setInterval(() => { $('elapsed').textContent = `${Math.floor((Date.now() - started) / 1000)}s` }, 1000)
  timeout = setTimeout(() => fail('Loading took too long. Check your connection and retry.'), 45_000)
}
function showReady() {
  canvas.focus({ preventScroll: true })
  if (!canvas.width || !canvas.height || !engineArmed) { $('loading-detail').textContent = 'Feeding the first ball…'; requestAnimationFrame(showReady); return }
  if (lastRuntimeError) { fail('The table could not start. Please retry.'); return }
  stopTimer(); ready = true; $('loader').hidden = true; canvas.hidden = false
  for (const id of ['new-game','pause','sound']) $(id).disabled = false
  for (const button of document.querySelectorAll('[data-key]')) button.disabled = false
  fit(); soundLabel()
  // Suspend the engine's own audio context until the player opts in.
  applySound()
  canvas.focus({ preventScroll: true })
  announce('Hold Space to launch · ← → flippers')
}
async function start() {
  begin()
  const module = {
    canvas,
    onCabinetState(score, remaining, isPaused, message, armed, plungerPull) {
      engineArmed = Boolean(armed)
      window.Module.cabinetState = { launchReady: engineArmed, plungerPull }
      const feeding = ready && remaining > 0 && !engineArmed && !isPaused
      if (feeding && !feedingStarted) feedingStarted = Date.now()
      if (!feeding) feedingStarted = 0
      $('feeding').hidden = !feeding
      if (feeding) $('feed-elapsed').textContent = `${Math.floor((Date.now() - feedingStarted) / 1000)}s`
      const plunger = document.querySelector('[data-keycode="32"]')
      if (ready) plunger.disabled = feeding
      $('score').textContent = Math.max(0, score).toLocaleString('en-US')
      $('ball').textContent = remaining > 0 ? `${4 - remaining} / 3` : '—'
      paused = Boolean(isPaused)
      $('pause').querySelector('path').setAttribute('d', paused ? 'M8 5l11 7-11 7z' : 'M8 5v14M16 5v14')
      $('pause-veil').hidden = !paused
      $('pause').setAttribute('aria-label', paused ? 'Resume' : 'Pause')
      document.body.dataset.paused = String(paused)
      if (remaining === 0 && ready) announce('Game over · ↻ to play again')
      else if (paused) announce('Paused')
      else if (feeding) announce('Feeding ball…')
      else if (message && !/Awaiting Deployment/i.test(message)) announce(message.replace(/\n/g, ' · '))
      else announce('Hold Space to launch · ← → flippers')
    },
    arguments: [],
    locateFile: name => ASSETS + name,
    setStatus: message => { if (message) $('loading-detail').textContent = /Running/.test(message) ? 'Starting the table and controls…' : 'Loading runtime and table files…' },
    printErr: message => { console.error('[Space Cadet]', message); if (/missing|Could not|Error/i.test(message)) lastRuntimeError = String(message) },
    onExit: status => { if (status !== 0) { lastRuntimeError = 'Invalid table data'; fail('The table data could not be loaded. Check the local game files and retry.') } },
    onAbort: () => fail('The engine could not initialize. Retry to reload the table.'),
    instantiateWasm(imports, receiveInstance) {
      $('loading-detail').textContent = 'Downloading the Space Cadet engine…'
      void fetch(ASSETS + 'SpaceCadetPinball.wasm', { signal: AbortSignal.timeout(30_000) }).then(response => {
        if (!response.ok) throw new Error('Engine download failed')
        return response.arrayBuffer()
      }).then(bytes => {
        $('loading-detail').textContent = 'Initializing the Space Cadet engine…'
        return WebAssembly.instantiate(bytes, imports)
      }).then(result => receiveInstance(result.instance, result.module)).catch(() => fail('The engine download or initialization failed. Check your connection and retry.'))
      return {}
    },
    postRun: [() => requestAnimationFrame(() => requestAnimationFrame(showReady))],
  }
  // Fetch the data ourselves so legacy loader errors cannot leave a silent wait.
  try {
    const response = await fetch(ASSETS + 'SpaceCadetPinball.data', { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error('Table download failed')
    const data = await response.arrayBuffer()
    module.getPreloadedPackage = () => data
  } catch { fail('The free-play table could not be downloaded. Check your connection and retry.'); return }
  window.Module = module
  const script = document.createElement('script'); script.src = ASSETS + 'SpaceCadetPinball.js'
  script.onerror = () => fail('The engine download failed. Check your connection and retry.')
  document.head.appendChild(script)
}
$('new-game').addEventListener('click', () => { if (ready) { press('F2','F2',113); paused = false; $('pause').querySelector('path').setAttribute('d', 'M8 5v14M16 5v14'); announce('Game started. Hold Space, then release to launch.'); } })
$('pause').addEventListener('click', () => { if (ready) { press('F3','F3',114); paused = !paused; $('pause').querySelector('path').setAttribute('d', paused ? 'M8 5l11 7-11 7z' : 'M8 5v14M16 5v14')
      $('pause-veil').hidden = !paused; } })
$('resume-table').addEventListener('click', () => { if (ready && paused) press('F3','F3',114) })
$('sound').addEventListener('click', () => { if (ready) toggleSound() })
window.addEventListener('keydown', event => { if (event.code === 'F5') { event.preventDefault(); event.stopImmediatePropagation(); if (ready) toggleSound() } }, true)
$('retry').addEventListener('click', () => location.reload())
for (const button of document.querySelectorAll('[data-key]')) {
  let down = false
  button.addEventListener('pointerdown', event => {
    if (!ready) return
    event.preventDefault(); button.setPointerCapture(event.pointerId)
    // Focus can blur a previously keyboard-focused control. Release that hold
    // before starting the pointer hold, so blur cannot clear the new key state.
    canvas.focus({ preventScroll: true })
    down = true
    button.dataset.held = 'true'
    key('keydown', button.dataset.key, button.dataset.code, Number(button.dataset.keycode), false)
  })
  const release = () => { if (down) { down = false; button.dataset.held = 'false'; key('keyup', button.dataset.key, button.dataset.code, Number(button.dataset.keycode), false) } }
  button.addEventListener('keydown', event => {
    if (!ready || !['Space', 'Enter'].includes(event.code)) return
    event.preventDefault()
    if (!down) { down = true; button.dataset.held = 'true'; key('keydown', button.dataset.key, button.dataset.code, Number(button.dataset.keycode), false) }
  })
  button.addEventListener('keyup', event => {
    if (['Space', 'Enter'].includes(event.code)) { event.preventDefault(); release() }
  })
  button.addEventListener('blur', release)
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release)
}
// Let browser buttons receive their native Enter/Space activation, then stop
// those keys at the button before SDL's global keyboard listener sees them.
for (const button of document.querySelectorAll('button:not([data-key])')) {
  for (const type of ['keydown', 'keyup', 'keypress']) button.addEventListener(type, event => {
    if (['Space', 'Enter'].includes(event.code)) event.stopImmediatePropagation()
  })
}
// Arrow keys belong to the game; vertical arrows have no action and never scroll.
window.addEventListener('keydown', event => {
  // Target button listeners preserve browser defaults and isolate these keys.
  if (['Space', 'Enter'].includes(event.code) && event.target.closest?.('button:not([data-key])')) return
  if (['ArrowUp', 'ArrowDown'].includes(event.code)) { event.preventDefault(); event.stopImmediatePropagation(); return }
  if (!['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) return
  event.preventDefault()
  if (!event.target.closest?.('[data-key]')) {
    event.stopImmediatePropagation()
    if (ready && !event.repeat && (event.code !== 'Space' || engineArmed)) key('keydown', event.key, event.code, event.keyCode, false)
  }
}, true)
// SDL also listens to keypress and cancels Enter's browser click there.
window.addEventListener('keypress', event => {
  if (['Space', 'Enter'].includes(event.code) && event.target.closest?.('button:not([data-key])')) event.stopImmediatePropagation()
}, true)
window.addEventListener('keyup', event => {
  if (['Space', 'Enter'].includes(event.code) && event.target.closest?.('button:not([data-key])')) return
  if (!['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) return
  event.preventDefault()
  if (!event.target.closest?.('[data-key]')) {
    event.stopImmediatePropagation()
    if (ready) key('keyup', event.key, event.code, event.keyCode, false)
  }
}, true)
window.addEventListener('blur', () => {
  for (const [name, code, number] of [['ArrowLeft','ArrowLeft',37],['ArrowRight','ArrowRight',39],[' ','Space',32]]) key('keyup', name, code, number, false)
})
window.addEventListener('keydown', event => { if (event.code === 'Tab') document.body.dataset.keyboardFocus = 'true' }, true)
window.addEventListener('pointerdown', () => { document.body.dataset.keyboardFocus = 'false' }, true)
document.documentElement.dataset.appReady = 'true'
if (window.parent !== window) window.parent.postMessage({ protocol: 'analytics-games.bridge', version: 1, type: 'game.ready' }, location.origin)
void start()
