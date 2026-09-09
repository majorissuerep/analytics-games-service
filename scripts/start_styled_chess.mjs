import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryParent = resolve(scriptDirectory, '..', '..')
const modelRoot = join(repositoryParent, 'ml-anti-stockfish-service')
const platformPython = process.platform === 'win32'
  ? join(modelRoot, '.venv', 'Scripts', 'python.exe')
  : join(modelRoot, '.venv', 'bin', 'python')
const candidates = [process.env.STYLED_CHESS_PYTHON, platformPython].filter(Boolean)
const python = candidates.find((candidate) => {
  // The candidate list is limited to explicit operator/repository paths.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return existsSync(candidate)
}) ?? 'python'
const serverScript = join(scriptDirectory, 'styled_chess_server.py')
const child = spawn(python, [serverScript, ...process.argv.slice(2)], {
  cwd: resolve(scriptDirectory, '..'),
  env: process.env,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
