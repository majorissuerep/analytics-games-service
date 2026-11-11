import type { Metadata } from 'next'
import Link from 'next/link'
import { MaterialPreference } from '@/components/platform/MaterialPreference'
import { DemoControls } from './DemoControls'
import './design-system.css'

export const metadata: Metadata = { title: 'Prism design system', description: 'The shared foundations, materials, color roles, and components for Analytics Games.' }

const tones = [
  ['pink', 'Intent', 'Shared signature', 'Primary actions and selected tools. Pink marks the next deliberate step.'],
  ['violet', 'Identity', 'Optional app companion', 'This reference uses violet for specimen labels. Each app chooses its own companion, or none.'],
] as const
const specimens = [
  ['chess', 'Chess study', 'Board first. Analysis in a compact side ledger.', 'chess'],
  ['paint', 'Paint studio', 'Tools around an open canvas. Pigments keep their meaning.', 'paintbox'],
  ['mine', 'Minefield board', 'A dense field, quiet counters, clear recovery.', 'minefield'],
] as const

function AppMiniature({ kind }: { kind: string }) {
  return <div className={`prism-miniature prism-miniature-${kind}`} aria-hidden="true">
    {kind === 'chess' ? <><div className="prism-mini-board">{Array.from({ length: 16 }, (_, i) => <i key={i}>{i === 5 ? '♞' : i === 10 ? '♔' : ''}</i>)}</div><div className="prism-mini-ledger"><b>Study / 12</b><span>1. e4 e5</span><span>2. Nf3 Nc6</span><strong>Best continuation</strong></div></> : kind === 'paint' ? <><div className="prism-mini-tools"><b>✎</b><span>▱</span><span>○</span></div><div className="prism-mini-canvas"><span /></div><div className="prism-mini-pigments"><i /><i /><i /></div></> : <><div className="prism-mini-counters"><b>010 / Flags</b><span>00:42</span></div><div className="prism-mini-field">{Array.from({ length: 32 }, (_, i) => <i key={i} className={i < 12 ? 'open' : ''}>{i === 2 || i === 9 ? '1' : i === 6 ? '2' : i === 22 ? '⚑' : ''}</i>)}</div></>}
  </div>
}

export default function DesignSystemPage() {
  return <main className="app-surface prism-reference">
    <header className="ui-glass prism-nav">
      <Link href="/" className="prism-wordmark"><span className="ui-icon" aria-hidden><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M5.6 18.4 18.4 5.6" /></svg></span><span><strong>Prism</strong><small>Analytics Games · Design system</small></span></Link>
      <nav aria-label="Design system navigation"><a href="#foundations">Foundations</a><a href="#components">Components</a><Link href="/">Desktop ↗︎</Link></nav>
    </header>

    <section className="prism-hero">
      <div><span className="ui-badge" data-tone="pink">Reference / Version 2</span><h1>Shared care.<br /><em>Individual character.</em></h1><p>A working specimen lab for the interaction engine behind our apps. Consistent focus, feedback and access. Compositions made for each task.</p><div className="prism-actions"><a className="prism-action-primary" href="#components">Try the controls ↓</a><a href="#personalities">Compare app structures ↓</a></div></div>
      <aside className="ui-card prism-contract"><span className="prism-eyebrow">The boundary / 001</span><h2>Rules, not a uniform.</h2><dl><div><dt>Shared engine</dt><dd>Readable type, spacing, focus, control behavior, scoped waits and recovery.</dd></div><div><dt>App personality</dt><dd>Composition, density, material, shape and up to two decorative color families.</dd></div><div><dt>Meaning stays fixed</dt><dd>Game data and semantic states retain labels and their own domain colors.</dd></div></dl><p>XP owns the desktop frame. Prism lives inside it.</p></aside>
    </section>

    <section id="foundations" className="prism-section">
      <div className="prism-section-title"><div><span className="prism-eyebrow">01 / Foundations</span><h2>A small palette. Clear roles.</h2></div><p>This lab uses pink, violet and a neutral ramp. These are two choices, not a required palette for every app. State colors below appear only with a stated meaning.</p></div>
      <div className="prism-tone-grid">{tones.map(([tone, name, label, detail]) => <article className="ui-tone prism-tone-card" data-tone={tone} key={tone}><span className="prism-tone-swatch" /><small>{label}</small><h3>{name}</h3><p>{detail}</p></article>)}</div>
      <div className="prism-statuses"><span className="prism-status positive">✓ Complete</span><span className="prism-status info">ⓘ Information</span><span className="prism-status warning">! Needs attention</span><span className="prism-status negative">× Action failed</span></div>
    </section>

    <section className="prism-materials prism-section">
      <div><span className="prism-eyebrow">02 / Materials</span><h2>Compare the layers.</h2><p>Frosted control layers have a translucent fill, a fine light edge, and a soft shadow. Dense content keeps a stable surface. Labels and icons always stay opaque.</p><div className="prism-preference"><MaterialPreference /><small>Saved across apps on this site. System accessibility preferences take priority.</small></div></div>
      <div className="prism-material-stage"><div className="prism-material-shape one" /><div className="prism-material-shape two" /><div className="ui-glass prism-material-sample"><span className="ui-badge" data-tone="pink">Frosted material</span><h3>A bounded control layer.</h3><p>Frost separates floating controls from content. Text stays opaque; the nested specimen below has solid backing.</p><div className="ui-card prism-solid-sample"><b>Stable content</b><span>Dense data, clues, code, and playfields use solid backing.</span></div></div></div>
    </section>

    <section id="components" className="prism-section">
      <div className="prism-section-title"><div><span className="prism-eyebrow">03 / Components</span><h2>A complete interaction language.</h2></div><p>Shape, spacing, type, focus, selection, and feedback work together. Try the controls below.</p></div>
      <div className="prism-component-grid"><article className="ui-glass prism-component-panel"><h3>Actions, selection & feedback</h3><DemoControls /></article><article className="ui-card prism-type-panel"><span className="prism-eyebrow">Type & rhythm</span><h3>Make the next move clear.</h3><p>Readable labels. Predictable groups. Space between decisions.</p><div className="prism-type-values"><span className="ui-badge" data-tone="pink">4px spacing foundation</span><span className="ui-badge" data-tone="violet">10 / 16 / 24px radii</span><span className="ui-badge" data-tone="violet">40px controls</span></div><strong className="prism-number">01:42</strong><small>Tabular numbers keep changing values steady.</small><p>Keyboard focus uses a visible outline. Selection also changes the edge and fill. Reduced motion, solid materials, and forced colors keep the system usable.</p></article></div>
    </section>

    <section id="personalities" className="prism-section"><div className="prism-section-title"><div><span className="prism-eyebrow">04 / App personalities</span><h2>Same care. Different workspaces.</h2></div><p>Structural illustrations, not live app previews. Open each app to use its real tools and current design.</p></div><div className="prism-specimen-grid">{specimens.map(([kind, title, detail, id], index) => <article className="ui-card prism-specimen" key={id}><div className="prism-specimen-label"><span>Illustration / 0{index + 1}</span><span aria-hidden="true">↗</span></div><AppMiniature kind={kind} /><h3><Link href={`/games/${id}`}>{title}</Link></h3><p>{detail}</p><Link className="prism-open-app" href={`/games/${id}`}>Open {title.split(' ')[0]} →</Link></article>)}</div><p className="prism-caption">Miniature pigments and board marks illustrate domain data. They do not add decorative palette requirements.</p></section>

    <footer className="prism-footer"><span>Prism · Shared application design system</span><Link href="/develop">Integration guide</Link><a href="https://github.com/majorissuerep/analytics-games-service/blob/master/docs/DESIGN_SYSTEM_RESEARCH.md">Research & decisions ↗︎</a><a href="https://github.com/majorissuerep/analytics-games-service/blob/master/docs/APPLICATION_DESIGN.md">Full specification ↗︎</a></footer>
  </main>
}
