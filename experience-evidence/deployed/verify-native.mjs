import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { committedNativeAssets } from '../../scripts/experience/runtime.mjs'
const commit = 'b63e82a0af6d5648f85c431b178914e90163dbdc'
const base = 'https://analytics-games-service.vercel.app'
const expected = committedNativeAssets(process.cwd(), commit)
const response = await fetch(`${base}/api/build-identity`, { signal: AbortSignal.timeout(20000), cache: 'no-store' })
assert.equal(response.status, 200)
const identity = await response.json()
assert.equal(identity.commit, commit)
for (const [path, sha256] of Object.entries(expected)) {
  const asset = await fetch(`${base}/${path.replace(/^public\//, '')}`, { signal: AbortSignal.timeout(60000), cache: 'no-store' })
  assert.equal(asset.status, 200)
  const bytes = Buffer.from(await asset.arrayBuffer())
  const actual = createHash('sha256').update(bytes).digest('hex')
  assert.equal(actual, sha256)
  assert.equal(identity.nativeAssets[path], actual)
  console.log(JSON.stringify({ path, bytes: bytes.length, sha256: actual, verifiedAgainst: commit }))
}
