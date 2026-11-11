const status = document.querySelector('#status')
const canvas = document.querySelector('#canvas')
const loading = document.querySelector('#workbench-loading')
const label = document.querySelector('#loading-label')
const started = Date.now()
const clock = setInterval(() => { document.querySelector('#loading-elapsed').textContent = Math.floor((Date.now() - started) / 1000) + 's' }, 1000)
const timeout = setTimeout(() => fail(new Error('The workbench took too long to open. Please retry.')), 60000)
document.querySelector('#retry').addEventListener('click', () => location.reload())
function fail(error) {
  clearInterval(clock); clearTimeout(timeout)
  loading.setAttribute('aria-busy', 'false')
  loading.querySelector('[role="progressbar"]').hidden = true
  document.querySelector('#retry').hidden = false
  label.setAttribute('role', 'alert')
  setStatus(error.message || 'The workbench could not open. Please retry.', true)
}

function setStatus(message, isError = false) {
  status.textContent = message
  label.textContent = message
  status.classList.toggle('error', isError)
}

async function loadScript(url) {
  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.onload = resolve
    script.onerror = () => reject(new Error(`Failed to load ${url}`))
    document.head.appendChild(script)
  })
}

async function boot() {
  const index = await fetch('/content-index.json').then(response => {
    if (!response.ok) throw new Error(`Content index failed: ${response.status}`)
    return response.json()
  })
  const requestedId = new URLSearchParams(location.search).get('evaluation')
  const evaluation = requestedId
    ? index.evaluations.find(item => item.id === requestedId)
    : index.evaluations[0]
  if (!evaluation) throw new Error(`Unknown evaluation: ${requestedId ?? '(none available)'}`)

  document.querySelector('#evaluation-name').textContent = evaluation.name
  document.querySelector('#focus-body').textContent = evaluation.focusBodyId
  document.querySelector('#local-scale').textContent = `${evaluation.scale.metersPerCell} m / cell`
  document.querySelector('#domain-size').textContent = `${evaluation.scale.widthM} × ${evaluation.scale.heightM} m`
  document.querySelector('#projection').textContent = evaluation.projection.replaceAll('-', ' ')

  setStatus(`Loading ${evaluation.name}…`)
  const scene = await fetch(evaluation.sceneUrl).then(response => {
    if (!response.ok) throw new Error(`Scene failed: ${response.status}`)
    return response.text()
  })

  setStatus('Loading the simulation runtime…')
  await loadScript('/tpt/powder.js')
  if (typeof window.create_powder !== 'function') {
    throw new Error('Powder Toy factory did not load')
  }

  window.mark_presentable = () => {
    clearInterval(clock); clearTimeout(timeout)
    loading.hidden = true
    canvas.classList.add('ready')
    setStatus(`${evaluation.name} — ${evaluation.scale.metersPerCell} m/cell — paused for inspection`)
  }

  setStatus('Initializing the simulation and scene…')
  const powderModule = await window.create_powder({
    canvas,
    arguments: ['ddir:/workspace', 'disable-network'],
    print: message => console.log(`[powder] ${message}`),
    printErr: message => console.error(`[powder] ${message}`),
    preRun: [runtime => {
      if (!runtime.FS) throw new Error('Powder Toy build does not export Emscripten FS')
      try {
        runtime.FS.mkdir('/workspace')
      } catch (error) {
        if (!String(error).includes('File exists')) throw error
      }
      runtime.FS.writeFile('/workspace/autorun.lua', scene)
    }],
  })

  window.powderDev = { module: powderModule, index, evaluation }
}

boot().catch(error => {
  console.error(error)
  fail(error)
})
