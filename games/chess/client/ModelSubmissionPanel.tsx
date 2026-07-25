'use client'

import { useEffect, useState, type FormEvent } from 'react'

type Source = 'huggingface' | 'direct'

export function ModelSubmissionPanel() {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<Source>('huggingface')
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [runtime, setRuntime] = useState('onnx-policy-v1')
  const [license, setLicense] = useState('apache-2.0')
  const [repoId, setRepoId] = useState('')
  const [revision, setRevision] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [directUpload, setDirectUpload] = useState(false)

  useEffect(() => {
    fetch('/api/chess-models').then(response => response.json()).then((body: { capabilities?: { directUpload?: boolean } }) => {
      setDirectUpload(Boolean(body.capabilities?.directUpload))
    }).catch(() => undefined)
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setMessage('')
    try {
      let body: Record<string, unknown> = { source, name, displayName, description, runtime, license }
      if (source === 'huggingface') {
        body = { ...body, repoId, revision }
      } else {
        if (!file) throw new Error('Choose a model package first')
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
        const sha256 = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
        body = { ...body, fileName: file.name, sizeBytes: file.size, sha256 }
      }
      const response = await fetch('/api/chess-models', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      })
      const result = await response.json() as { error?: string; submission?: { receipt: string }; upload?: { url: string; requiredHeaders: Record<string, string> } }
      if (!response.ok || !result.submission) throw new Error(result.error || 'Submission failed')
      if (source === 'direct' && file && result.upload) {
        const upload = await fetch(result.upload.url, { method: 'PUT', headers: result.upload.requiredHeaders, body: file })
        if (!upload.ok) throw new Error('The submission was registered, but artifact upload failed')
      }
      setMessage(`Submitted for scanning and admin review. Save receipt: ${result.submission.receipt}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Submission failed')
    } finally {
      setPending(false)
    }
  }

  return <section className="chess-model-submit">
    <button className="chess-model-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}>
      <span>◇</span><b>Bring your own Chess model</b><small>Safe ONNX or Hugging Face submission</small>
    </button>
    {open && <form onSubmit={(event) => void submit(event)}>
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
      <label>Description<textarea maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Architecture, training data, intended strength…" /></label>
      {source === 'huggingface' ? <div className="chess-model-grid">
        <label>Repository<input required value={repoId} onChange={event => setRepoId(event.target.value)} placeholder="organization/model-name" /></label>
        <label>Immutable commit SHA<input required pattern="[a-f0-9]{40}" value={revision} onChange={event => setRevision(event.target.value)} placeholder="40-character commit SHA" /></label>
      </div> : <label>Model package (.zip or .tar.zst, maximum 1 GiB)<input required type="file" accept=".zip,.tar.zst" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>}
      <button className="chess-primary" disabled={pending}>{pending ? 'Validating…' : 'Submit for review'}</button>
      {message && <p className="chess-notice" role="status">{message}</p>}
      <small>Allowed data only: ONNX or safetensors. Python, pickle, custom code, mutable HF branches, and custom containers are rejected.</small>
    </form>}
  </section>
}
