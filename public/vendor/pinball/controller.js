// File data is held only in this document's memory and discarded when the app closes.
const frame = document.querySelector('iframe')
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return
  const data = event.data
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
