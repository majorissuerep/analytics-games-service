const status = document.querySelector('#status')
const canvas = document.querySelector('#canvas')

function setStatus(message, isError = false) {
  status.textContent = message
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

  setStatus(`Loading ${evaluation.name}…`)
  const scene = await fetch(evaluation.sceneUrl).then(response => {
    if (!response.ok) throw new Error(`Scene failed: ${response.status}`)
    return response.text()
  })

  await loadScript('/tpt/powder.js')
  if (typeof window.create_powder !== 'function') {
    throw new Error('Powder Toy factory did not load')
  }

  window.mark_presentable = () => {
    canvas.classList.add('ready')
    setStatus(`${evaluation.name} — ${evaluation.scale.metersPerCell} m/cell — paused for inspection`)
  }

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
  setStatus(error.stack ?? String(error), true)
})
