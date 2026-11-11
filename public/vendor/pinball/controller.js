// File data is held only in this document's memory and discarded when the app closes.
const frame = document.querySelector('iframe')
let files = null
let attempt = 0
const allowed = name => /^(PINBALL\.DAT|FONT\.DAT|SOUND\w*\.WAV|PINBALL\d?\.MID|TABLE\.BMP)$/i.test(name)
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return
  const data = event.data
  if (data?.type === 'space-cadet:awaiting-data') frame.contentWindow.postMessage({ type: 'space-cadet:start', files }, location.origin)
  if (data?.type === 'space-cadet:free-play') { files = null; frame.src = `runtime.html?runtime=1&attempt=${++attempt}` }
  if (data?.type === 'space-cadet:import') {
    const incoming = data.files
    if (!Array.isArray(incoming) || incoming.length > 100 || !incoming.some(file => file.name === 'PINBALL.DAT') || incoming.some(file => !allowed(file.name) || !(file.bytes instanceof Uint8Array) || file.bytes.byteLength > 16 * 1024 * 1024) || incoming.reduce((sum, file) => sum + file.bytes.byteLength, 0) > 48 * 1024 * 1024) return
    files = incoming
    frame.src = `runtime.html?runtime=1&attempt=${++attempt}`
  }
  if (data?.protocol === 'analytics-games.bridge' && data.version === 1 && ['game.ready','game.exit','game.telemetry'].includes(data.type)) {
    if (data.type === 'game.ready') {
      document.getElementById('cabinet-boot')?.remove()
      frame.style.visibility = 'visible'
    }
    document.documentElement.dataset.appReady = 'true'
    if (window.parent !== window) window.parent.postMessage(data, location.origin)
    else if (data.type === 'game.exit') location.assign('/')
  }
})

// Register every handler before navigation. A cached child may otherwise post its
// only startup message before this module finishes loading.
frame.src = 'runtime.html?runtime=1'
