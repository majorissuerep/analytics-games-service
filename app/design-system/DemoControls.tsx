'use client'

import { useState } from 'react'

export function DemoControls() {
  const [view, setView] = useState('Overview')
  const [complete, setComplete] = useState(false)
  return <div className="prism-demo-controls">
    <div className="prism-segments" role="group" aria-label="Example view">
      {['Overview', 'Analysis', 'Team'].map(label => <button key={label} aria-pressed={view === label} onClick={() => setView(label)}>{label}</button>)}
    </div>
    <p><strong>{view}</strong> selected. The filled segment, border, and label show the current view.</p>
    <label className="prism-field">Session name<input placeholder="Friday game night" /></label>
    <div className="prism-actions">
      <button className="ui-primary" onClick={() => setComplete(true)}>Preview feedback</button>
      <button onClick={() => setComplete(false)}>Reset</button>
      <button disabled>Unavailable</button>
    </div>
    <p className={`prism-feedback${complete ? ' complete' : ''}`} role="status">{complete ? '✓ Sample action completed. Ready for the next step.' : 'This is an interactive component example.'}</p>
  </div>
}
