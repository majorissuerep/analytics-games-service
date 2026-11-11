'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { LoadingState } from '@/components/ui/LoadingState'
import { fetchWithTimeout } from '@/lib/engine/client/fetch-with-timeout'

type Source = 'huggingface' | 'direct'
type RegistryModel = { slug: string; displayName: string; state: string; runtimeId: string }

export function ModelSubmissionPanel({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  const [source, setSource] = useState<Source>('huggingface')
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [runtime, setRuntime] = useState('onnx-policy-v1')
  const [license, setLicense] = useState('apache-2.0')
  const [contact, setContact] = useState('')
  const [repoId, setRepoId] = useState('')
  const [revision, setRevision] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [stage, setStage] = useState('')
  const [uploaded, setUploaded] = useState<{ completed: number; total: number } | null>(null)
  const [registryLoading, setRegistryLoading] = useState(true)
  const [registryRetry, setRegistryRetry] = useState(0)
  const [message, setMessage] = useState('')
  const [directUpload, setDirectUpload] = useState(false)
  const [registry, setRegistry] = useState<RegistryModel[]>([])
  const [registryError, setRegistryError] = useState('')

  const loadRegistry = useCallback(async (signal?: AbortSignal) => {
    const response = await fetchWithTimeout('/api/chess-models', { signal })
    if (!response.ok) throw new Error(`Registry unavailable (${response.status})`)
    const body = await response.json() as { capabilities?: { directUpload?: boolean }; registry?: RegistryModel[] }
    if (signal?.aborted) return
    setDirectUpload(Boolean(body.capabilities?.directUpload))
    setRegistry(body.registry ?? [])
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => { void loadRegistry(controller.signal).catch(() => {
      if (!controller.signal.aborted) setRegistryError('The model registry is unavailable. Please retry.')
    }).finally(() => { if (!controller.signal.aborted) setRegistryLoading(false) }) })
    return () => controller.abort()
  }, [loadRegistry, registryRetry])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setStage('Validating the model submission')
    setUploaded(null)
    setMessage('')
    try {
      let body: Record<string, unknown> = { source, name, displayName, description, runtime, license }
      if (contact.trim()) body = { ...body, submitterContact: contact.trim() }
      if (source === 'huggingface') {
        body = { ...body, repoId, revision }
      } else {
        if (!file) throw new Error('Choose a model package first')
        setStage('Computing the package checksum')
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
        const sha256 = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
        body = { ...body, fileName: file.name, sizeBytes: file.size, sha256 }
      }
      setStage('Registering the submission')
      const response = await fetchWithTimeout('/api/chess-models', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      })
      const result = await response.json() as { error?: string; submission?: { receipt: string }; upload?: { url: string; requiredHeaders: Record<string, string> } }
      if (!response.ok || !result.submission) throw new Error(result.error || 'Submission failed')
      if (source === 'direct' && file && result.upload) {
        setStage('Uploading the model package')
        await new Promise<void>((resolve, reject) => {
          const upload = new XMLHttpRequest()
          upload.open('PUT', result.upload!.url)
          upload.timeout = 10 * 60 * 1000
          Object.entries(result.upload!.requiredHeaders).forEach(([key, value]) => upload.setRequestHeader(key, value))
          upload.upload.onprogress = event => {
            if (event.lengthComputable) setUploaded({ completed: event.loaded, total: event.total })
          }
          upload.onload = () => upload.status >= 200 && upload.status < 300 ? resolve() : reject(new Error('The submission was registered, but artifact upload failed. Please retry.'))
          upload.onerror = upload.ontimeout = () => reject(new Error('The upload connection failed. Please retry.'))
          upload.send(file)
        })
      }
      setMessage(`Submitted for scanning and admin review. Save receipt: ${result.submission.receipt}`)
      setStage('Refreshing the model registry')
      setUploaded(null)
      await loadRegistry().catch(() => setRegistryError('Submission received. Registry refresh failed; retry the registry below.'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Submission failed')
    } finally {
      setPending(false)
    }
  }

  return <section className="chess-model-submit">
    <button className="chess-model-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="chess-model-submission-form">
      <span>◇</span><b>Bring your own Chess model</b><small>Safe ONNX or Hugging Face submission</small>
    </button>
    {open && registryLoading && <LoadingState scope="inline" label="Loading the model registry" />}
    {open && (registryError ? <p className="chess-notice" role="alert">{registryError} <button onClick={() => { setRegistryLoading(true); setRegistryError(''); setRegistryRetry(value => value + 1) }}>Retry registry</button></p> : registry.length > 0 && <div className="chess-model-registry"><b>Community model registry</b>{registry.map(model => <div key={`${model.slug}-${model.state}`}><span>{model.displayName}<small>{model.runtimeId}</small></span><em>{model.state.replaceAll('_', ' ')}</em></div>)}</div>)}
    {open && <form id="chess-model-submission-form" onSubmit={(event) => void submit(event)}>
      <p>Submissions are quarantined, scanned, and require administrator approval before deployment or play.</p>
      <div className="chess-online-tabs">
        <button type="button" className={source === 'huggingface' ? 'active' : ''} onClick={() => setSource('huggingface')}>Hugging Face</button>
        <button type="button" disabled={!directUpload} title={directUpload ? '' : 'Direct object storage is not configured'} className={source === 'direct' ? 'active' : ''} onClick={() => setSource('direct')}>Upload package{directUpload ? '' : ' (unavailable)'}</button>
      </div>
      <div className="chess-model-grid">
        <label>Model slug<input required pattern="[a-z][a-z0-9-]{2,39}" value={name} onChange={event => setName(event.target.value)} placeholder="tactical-otter" /></label>
        <label>Display name<input required minLength={3} maxLength={80} value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Tactical Otter" /></label>
        <label>Runtime<select value={runtime} onChange={event => setRuntime(event.target.value)}><option value="onnx-policy-v1">ONNX policy v1</option><option value="hf-transformers-chess-v1">HF Transformers safetensors v1</option></select></label>
        <label>License<input required value={license} onChange={event => setLicense(event.target.value)} placeholder="apache-2.0" /></label>
      </div>
      <label>Contact email <span>(optional — for review updates)</span><input type="email" value={contact} onChange={event => setContact(event.target.value)} placeholder="you@example.com" /></label>
      <label>Description<textarea maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Architecture, training data, intended strength…" /></label>
      {source === 'huggingface' ? <div className="chess-model-grid">
        <label>Repository<input required value={repoId} onChange={event => setRepoId(event.target.value)} placeholder="organization/model-name" /></label>
        <label>Immutable commit SHA<input required pattern="[a-f0-9]{40}" value={revision} onChange={event => setRevision(event.target.value)} placeholder="40-character commit SHA" /></label>
      </div> : <label>Model package (.zip or .tar.zst, maximum 1 GiB)<input required type="file" accept=".zip,.tar.zst" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>}
      <button className="chess-primary" disabled={pending}>{pending ? 'Submitting…' : 'Submit for review'}</button>
      {pending && <LoadingState label={stage} completed={uploaded?.completed} total={uploaded?.total} />}
      {message && <p className="chess-notice" role="status">{message}</p>}
      <small>Allowed data only: ONNX or safetensors. Python, pickle, custom code, mutable HF branches, and custom containers are rejected.</small>
    </form>}
  </section>
}
