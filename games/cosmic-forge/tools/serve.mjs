/* eslint-disable security/detect-non-literal-fs-filename -- safePath confines every request to fixed runtime roots */
import { spawnSync } from 'node:child_process'
import { createReadStream, existsSync, statSync, watch } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import { buildRoot, gameRoot, runtimeOutputRoot } from './content-lib.mjs'

const assembleCommand = resolve(gameRoot, 'tools/assemble-runtime.mjs')
function assemble() {
  return spawnSync(process.execPath, [assembleCommand], { stdio: 'inherit' }).status === 0
}

if (!assemble()) process.exit(1)
if (!existsSync(resolve(buildRoot, 'powder.js')) || !existsSync(resolve(buildRoot, 'powder.wasm'))) {
  console.error('Powder Toy is not built. Run: bash games/cosmic-forge/tools/build-wasm.sh')
  process.exit(1)
}

const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.lua', 'text/plain; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.map', 'application/json; charset=utf-8'],
])

function safePath(base, requested) {
  const path = resolve(base, requested)
  if (path !== base && !path.startsWith(`${base}${sep}`)) return null
  return path
}

const server = createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method ?? '')) {
    response.writeHead(405).end()
    return
  }
  const url = new URL(request.url ?? '/', 'http://localhost')
  let base = runtimeOutputRoot
  let requested = decodeURIComponent(url.pathname).replace(/^\/+/, '')
  if (url.pathname.startsWith('/tpt/')) {
    base = buildRoot
    requested = decodeURIComponent(url.pathname.slice('/tpt/'.length))
  } else if (!requested) {
    requested = 'index.html'
  }
  const path = safePath(base, requested)
  if (!path || !existsSync(path) || !statSync(path).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found')
    return
  }
  response.writeHead(200, {
    'Content-Type': types.get(extname(path)) ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin',
  })
  if (request.method === 'HEAD') {
    response.end()
    return
  }
  createReadStream(path).pipe(response)
})

const port = Number.parseInt(process.env.PORT ?? '4177', 10)
server.listen(port, '127.0.0.1', () => {
  console.log(`Cosmic Forge workbench: http://127.0.0.1:${port}/?evaluation=cinder-material-lab`)
})

let assembleTimer
for (const sourceRoot of [join(gameRoot, 'content'), join(gameRoot, 'runtime')]) {
  watch(sourceRoot, { recursive: true }, () => {
    clearTimeout(assembleTimer)
    assembleTimer = setTimeout(() => {
      if (assemble()) {
        console.log('Content changed: runtime refreshed; reload the browser')
      } else {
        console.error('Content changed: validation failed; serving the last valid runtime')
      }
    }, 100)
  })
}
