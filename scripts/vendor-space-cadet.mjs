/* eslint-disable security/detect-non-literal-fs-filename -- Paths come only from the checked-in provenance allowlist. */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
const root = new URL('../public/vendor/space-cadet/', import.meta.url)
const provenance = JSON.parse(await readFile(new URL('provenance.json', root), 'utf8'))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
async function download(url, expected) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed: ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (hash(bytes) !== expected) throw new Error(`Checksum mismatch: ${url}`)
  return bytes
}
if (process.argv.includes('--verify')) {
  for (const [name, artifact] of Object.entries(provenance.artifacts)) {
    const bytes = await readFile(new URL(name, root))
    if (hash(bytes) !== artifact.sha256 || bytes.length !== artifact.bytes) throw new Error(`Asset changed: ${name}`)
  }
  console.log('Space Cadet engine and CC0 data checksums verified.')
} else {
  const engineBase = `https://raw.githubusercontent.com/alula/SpaceCadetPinball/${provenance.engine.commit}/`
  const [engine, wasm, ...data] = await Promise.all([
    download(engineBase + 'SpaceCadetPinball.js', provenance.engine.originalJavascriptSha256),
    download(engineBase + 'SpaceCadetPinball.wasm', provenance.artifacts['SpaceCadetPinball.wasm'].sha256),
    ...provenance.data.files.map(file => download(`https://raw.githubusercontent.com/andrewnakas/open-cadet/${provenance.data.commit}/${file.name === 'PINBALL.DAT' ? file.name : file.name.toLowerCase()}`, file.sha256)),
  ])
  const metadata = { files: [], remote_package_size: data.reduce((sum, bytes) => sum + bytes.length, 0), package_uuid: provenance.data.commit }
  let offset = 0
  data.forEach((bytes, i) => { metadata.files.push({ filename: `/game_resources/${provenance.data.files[i].name}`, start: offset, end: offset + bytes.length, audio: 0 }); offset += bytes.length })
  const source = engine.toString('utf8'), start = source.indexOf('loadPackage({') + 'loadPackage('.length
  let end = start, depth = 0, quoted = false, escaped = false
  for (; end < source.length; end++) {
    const c = source[end]
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false }
    else if (c === '"') quoted = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) { end++; break }
  }
  const javascript = Buffer.from(source.slice(0, start) + JSON.stringify(metadata) + source.slice(end))
  for (const [name, bytes] of [['SpaceCadetPinball.js', javascript], ['SpaceCadetPinball.wasm', wasm], ['SpaceCadetPinball.data', Buffer.concat(data)]]) {
    if (hash(bytes) !== provenance.artifacts[name].sha256) throw new Error(`Generated artifact mismatch: ${name}`)
    await writeFile(new URL(name, root), bytes)
  }
  console.log('Regenerated pinned engine + CC0 data; no original Microsoft resources downloaded.')
}
