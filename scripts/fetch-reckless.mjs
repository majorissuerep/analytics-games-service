#!/usr/bin/env node
// Fetch the pinned Reckless 0.9.0 UCI binary for local/CI/production builds.
// The binary is too large to commit, so builds download it from the upstream
// GitHub release and verify the exact SHA-256 before use.
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { dirname } from 'node:path'

const VERSION = 'v0.9.0'
const URL = `https://github.com/codedeliveryservice/Reckless/releases/download/${VERSION}/reckless-linux-avx2`
const SHA256 = '09ba1634faaffec55d237a7efecfb27d5152f6f1400f24dd63af9bde00a054f6'
const TARGET = process.argv[2] ?? 'vendor/native/reckless/reckless'

async function main() {
  if (existsSync(TARGET)) {
    const current = createHash('sha256').update(readFileSync(TARGET)).digest('hex')
    if (current === SHA256) {
      console.log(`[reckless] ${TARGET} already present (sha256 ok)`)
      return
    }
    console.log(`[reckless] ${TARGET} exists but sha256 mismatch — re-fetching`)
  }
  console.log(`[reckless] downloading ${URL}`)
  const response = await fetch(URL)
  if (!response.ok) throw new Error(`download failed: ${response.status} ${response.statusText}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (hash !== SHA256) throw new Error(`sha256 mismatch: got ${hash}, want ${SHA256}`)
  mkdirSync(dirname(TARGET), { recursive: true })
  writeFileSync(TARGET, bytes)
  chmodSync(TARGET, 0o755)
  const size = statSync(TARGET).size
  console.log(`[reckless] ${TARGET} ready (${Math.round(size / 1024 / 1024)} MiB, sha256 ok)`)
}

main().catch((error) => {
  console.error(`[reckless] ${error.message}`)
  process.exit(1)
})
