const ALLOWED_TEXT = /(^|\/)(\.gitattributes|LICENSE|[^/]+\.(json|txt|md)|chess-model\.yaml)$/i
const FORBIDDEN = /\.(py|sh|bash|exe|dll|so|dylib|pkl|pickle|joblib|pt|pth|bin|js|mjs|cjs)$/i
const MAX_BYTES = 1_073_741_824

export type HuggingFaceInspection = {
  sourceRef: string
  files: Array<{ name: string; size: number }>
  totalBytes: number
}

export async function inspectHuggingFaceRevision(repoId: string, revision: string): Promise<HuggingFaceInspection> {
  const encodedRepo = repoId.split('/').map(encodeURIComponent).join('/')
  const response = await fetch(`https://huggingface.co/api/models/${encodedRepo}/revision/${revision}?blobs=true`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(response.status === 404 ? 'Hugging Face model revision was not found' : 'Hugging Face inspection failed')

  const body = await response.json() as {
    sha?: string
    siblings?: Array<{ rfilename?: string; size?: number; lfs?: { size?: number } }>
  }
  if (body.sha !== revision) throw new Error('Hugging Face did not resolve the requested immutable revision')
  const files = (body.siblings ?? []).map(file => ({ name: file.rfilename ?? '', size: file.lfs?.size ?? file.size ?? 0 }))
  if (!files.length) throw new Error('Hugging Face revision contains no files')
  for (const file of files) {
    if (!file.name || file.name.includes('..') || file.name.startsWith('/') || FORBIDDEN.test(file.name)) {
      throw new Error(`Hugging Face revision contains forbidden file: ${file.name || '(unnamed)'}`)
    }
    const allowedModel = /(^|\/)(model\.safetensors|model\.onnx)$/.test(file.name) || /\.safetensors$/.test(file.name)
    if (!allowedModel && !ALLOWED_TEXT.test(file.name)) throw new Error(`Hugging Face revision contains unsupported file: ${file.name}`)
  }
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  if (totalBytes > MAX_BYTES) throw new Error('Hugging Face revision exceeds the 1 GiB limit')
  if (!files.some(file => file.name.endsWith('.onnx') || file.name.endsWith('.safetensors'))) {
    throw new Error('Hugging Face revision has no supported model artifact')
  }
  return { sourceRef: `hf://${repoId}@${revision}`, files, totalBytes }
}
