'use client'

import { useEffect, useRef, useState } from 'react'

import { LoadingState } from '@/components/ui/LoadingState'

export function DemoControls() {
  const [view, setView] = useState('Overview')
  const [complete, setComplete] = useState(false)
  const [pending, setPending] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  function reset() { clearTimeout(timer.current); setPending(false); setComplete(false) }
  function preview() { reset(); setPending(true); timer.current = setTimeout(() => { setPending(false); setComplete(true) }, 1200) }
  return <div className="prism-demo-controls">
    <div className="prism-segments" role="group" aria-label="Example view">
      {['Overview', 'Analysis', 'Team'].map(label => <button key={label} aria-pressed={view === label} onClick={() => setView(label)}>{label}</button>)}
    </div>
    <p><strong>{view}</strong> selected. The filled segment, border, and label show the current view.</p>
    <label className="prism-field">Session name<input placeholder="Friday game night" /></label>
    <div className="prism-actions">
      <button className="ui-primary" disabled={pending} onClick={preview}>Preview feedback</button>
      <button onClick={reset}>Reset</button>
      <button disabled>Unavailable</button>
    </div>
    {pending ? <LoadingState label="Preparing the preview" detail="Only this component waits; the rest of the page remains usable." onCancel={reset} /> : <p className={`prism-feedback${complete ? ' complete' : ''}`} role="status">{complete ? '✓ Sample action completed. Ready for the next step.' : 'This is an interactive component example.'}</p>}
  </div>
}
