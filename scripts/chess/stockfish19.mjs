// Node transport for the vendored Stockfish 19 WASM build. Runs off the web thread.
import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import createEngine from '../../public/vendor/stockfish/sf_19_smallnet.js'

const commands = []
let engine
createInterface({ input: process.stdin }).on('line', command => {
  if (command === 'quit') process.exit(0)
  if (engine) engine.uci(command)
  else commands.push(command)
}).on('close', () => process.exit(0))
engine = await createEngine({
  listen: line => process.stdout.write(`${line}\n`),
  onError: error => process.stderr.write(`${error}\n`),
})
// Bundled constant asset URL, not player input.
// eslint-disable-next-line security/detect-non-literal-fs-filename
engine.setNnueBuffer(new Uint8Array(await readFile(new URL('../../public/vendor/stockfish/nn-61e7af4bb97d.nnue', import.meta.url))))
for (const command of commands) engine.uci(command)
