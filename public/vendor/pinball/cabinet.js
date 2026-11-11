// Platform-owned cabinet. The MIT engine runtime is isolated in /vendor/space-cadet.
const $ = id => document.getElementById(id)
const canvas = $('canvas')
const ASSETS = '/vendor/space-cadet/'
const KEY = 'analytics-games.pinball.sound.v2'
let ready = false
let paused = false
let soundOn = false
let activeImport = false
let started = Date.now()
let timeout
let timer
let lastRuntimeError = ''
try { soundOn = localStorage.getItem(KEY) === 'true' } catch { /* Browser storage is optional. */ }

function announce(message, error = false) { $('notice').textContent = message; $('notice').classList.toggle('error', error) }
function key(type, key, code, keyCode) {
  canvas.focus({ preventScroll: true })
  canvas.dispatchEvent(new KeyboardEvent(type, { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true }))
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
function soundLabel() { $('sound').textContent = soundOn ? 'Sound on' : 'Sound off'; $('sound').setAttribute('aria-pressed', String(soundOn)) }
function fit() {
  if (!canvas.width || !canvas.height) return
  const stage = canvas.parentElement
  const width = Math.min(stage.clientWidth, stage.clientHeight * canvas.width / canvas.height)
  canvas.style.width = `${width}px`; canvas.style.height = `${width * canvas.height / canvas.width}px`
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
  canvas.hidden = false; canvas.width = 600; canvas.height = 440; fit()
  $('loader').hidden = false; $('progress').hidden = false; $('retry').hidden = true
  timer = setInterval(() => { $('elapsed').textContent = `${Math.floor((Date.now() - started) / 1000)}s` }, 1000)
  timeout = setTimeout(() => fail('Loading took too long. Retry or choose a different set of local files.'), 45_000)
}
function showReady() {
  if (!canvas.width || !canvas.height) { requestAnimationFrame(showReady); return }
  if (lastRuntimeError) { fail('The selected files could not be opened. Check PINBALL.DAT and try again.'); return }
  stopTimer(); ready = true; $('loader').hidden = true; canvas.hidden = false
  for (const id of ['new-game','pause','sound']) $(id).disabled = false
  for (const button of document.querySelectorAll('[data-key]')) button.disabled = false
  fit(); soundLabel()
  // Suspend the engine's own audio context until the player opts in.
  applySound()
  announce(activeImport ? 'Original files loaded locally. F2 starts a game.' : 'Free-play ready · Space Cadet engine with original CC0 replacement art.')
}
async function start(originalFiles) {
  begin()
  const module = {
    canvas,
    arguments: [],
    locateFile: name => ASSETS + name,
    setStatus: message => { if (message) $('loading-detail').textContent = /Running/.test(message) ? 'Starting the table and controls…' : 'Loading runtime and table files…' },
    printErr: message => { console.error('[Space Cadet]', message); if (/missing|Could not|Error/i.test(message)) lastRuntimeError = String(message) },
    onExit: status => { if (status !== 0) { lastRuntimeError = 'Invalid table data'; fail('The table data could not be loaded. Check the local game files and retry.') } },
    onAbort: () => fail('The engine could not initialize. Retry, or check the imported game files.'),
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
  if (originalFiles) {
    // Override default resources with user-local bytes before main. No network upload.
    module.onRuntimeInitialized = () => {
      for (const file of originalFiles) {
        try { module.FS_unlink('/game_resources/' + file.name) } catch { /* New sound name. */ }
        module.FS_createDataFile('/game_resources', file.name, file.bytes, true, true)
      }
    }
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
$('new-game').addEventListener('click', () => { if (ready) { press('F2','F2',113); paused = false; $('pause').textContent = 'Pause'; announce('Game started. Hold Space, then release to launch.'); } })
$('pause').addEventListener('click', () => { if (ready) { press('F3','F3',114); paused = !paused; $('pause').textContent = paused ? 'Resume' : 'Pause'; } })
$('sound').addEventListener('click', () => { if (ready) toggleSound() })
window.addEventListener('keydown', event => { if (event.code === 'F5') { event.preventDefault(); event.stopImmediatePropagation(); if (ready) toggleSound() } }, true)
$('exit').addEventListener('click', () => {
  if (window.parent !== window) window.parent.postMessage({ protocol: 'analytics-games.bridge', version: 1, type: 'game.exit', payload: { reason: 'cancel' } }, window.location.origin)
  else location.assign('/')
})
$('retry').addEventListener('click', () => location.reload())
$('free-play').addEventListener('click', () => window.parent.postMessage({ type: 'space-cadet:free-play' }, location.origin))
for (const button of document.querySelectorAll('[data-key]')) {
  let down = false
  button.addEventListener('pointerdown', event => {
    if (!ready) return
    event.preventDefault(); button.setPointerCapture(event.pointerId); down = true
    key('keydown', button.dataset.key, button.dataset.code, Number(button.dataset.keycode))
  })
  const release = () => { if (down) { down = false; key('keyup', button.dataset.key, button.dataset.code, Number(button.dataset.keycode)) } }
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release)
}
$('original-files').addEventListener('change', async event => {
  const files = [...event.target.files]
  if (!files.length) return
  if (!files.some(file => file.name.toUpperCase() === 'PINBALL.DAT')) { announce('Choose PINBALL.DAT together with the sound files from your own game folder.', true); return }
  if (files.length > 100 || files.some(file => !/^(PINBALL\.DAT|FONT\.DAT|SOUND\w*\.WAV|PINBALL\d?\.MID|TABLE\.BMP)$/i.test(file.name) || file.size > 16 * 1024 * 1024) || files.reduce((sum, file) => sum + file.size, 0) > 48 * 1024 * 1024) {
    announce('Choose only the game data and sounds, up to 48 MB total. Executables are not needed.', true); return
  }
  // Engine instances run in their own document. Restart this document with local
  // file bytes delivered through a same-origin MessageChannel; never persist/upload.
  const bytes = await Promise.all(files.map(async file => ({ name: file.name.toUpperCase(), bytes: new Uint8Array(await file.arrayBuffer()) })))
  window.dispatchEvent(new CustomEvent('space-cadet:local-files', { detail: bytes }))
  announce('Local import is preparing…')
})
// The parent document can retain user-selected bytes across a runtime-only frame
// restart. A direct cabinet launch uses the same small outer import controller.
window.addEventListener('space-cadet:local-files', event => {
  window.parent.postMessage({ type: 'space-cadet:import', files: event.detail }, window.location.origin)
})
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'space-cadet:start') return
  activeImport = Boolean(event.data.files)
  $('art-label').textContent = activeImport ? 'Your original XP files · local' : 'Open Cadet art · CC0'
  $('free-play').hidden = !activeImport
  void start(event.data.files)
})
document.documentElement.dataset.appReady = 'true'
if (window.parent !== window) window.parent.postMessage({ protocol: 'analytics-games.bridge', version: 1, type: 'game.ready' }, window.location.origin)
// A same-origin outer controller handles restart without reusing a running WASM instance.
if (window.parent === window || !new URLSearchParams(location.search).has('runtime')) void start()
else window.parent.postMessage({ type: 'space-cadet:awaiting-data' }, location.origin)
