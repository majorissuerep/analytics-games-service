'use client'

import { useEffect, useState } from 'react'

export interface LoadingStateProps {
  label: string
  detail?: string
  scope?: 'page' | 'app' | 'section' | 'inline'
  completed?: number
  total?: number
  onCancel?: () => void
  cancelLabel?: string
}

/** Unknown work stays indeterminate. Never infer a completion percentage from time. */
export function LoadingState({ label, detail, scope = 'section', completed, total, onCancel, cancelLabel = 'Cancel' }: LoadingStateProps) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])
  const determinate = typeof total === 'number' && total > 0 && typeof completed === 'number' && Number.isFinite(completed) && Number.isFinite(total)
  const percent = determinate ? Math.min(100, Math.max(0, completed / total * 100)) : undefined
  return <div className={`${scope === 'page' || scope === 'app' ? 'app-surface ' : ''}ui-loading ui-loading-${scope}`} data-scope={scope}>
    <div className="ui-loading-content">
      <div className="ui-loading-heading"><div role="status" aria-live="polite" aria-atomic="true"><strong>{label}</strong>{detail && <span className="ui-loading-detail">{detail}</span>}</div><span className="ui-loading-elapsed" role="timer" aria-label="Elapsed time">{elapsed}s</span></div>
      <div className="ui-loading-meter" role="progressbar" aria-busy="true" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent === undefined ? undefined : Math.round(percent)} data-determinate={determinate}>
        <span style={percent === undefined ? undefined : { width: `${percent}%` }} />
      </div>
      <div className="ui-loading-footer">{percent === undefined ? <small>Working…</small> : <small>{Math.round(percent)}%</small>}{onCancel && <button type="button" onClick={onCancel}>{cancelLabel}</button>}</div>
    </div>
  </div>
}
