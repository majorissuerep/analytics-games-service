import type { Metadata } from 'next'
import Link from 'next/link'
import { MaterialPreference } from '@/components/platform/MaterialPreference'
import { DemoControls } from './DemoControls'
import './design-system.css'

export const metadata: Metadata = { title: 'Prism design system', description: 'The shared foundations, materials, color roles, and components for Analytics Games.' }

const tones = [
  ['pink', 'Pink', 'Intent & selection', 'Primary actions, current mode, selected tools.'],
  ['violet', 'Violet', 'Analysis & insight', 'Engines, analysis views, secondary categories.'],
  ['teal', 'Teal', 'Together & creating', 'Shared rooms, collaborators, creative work.'],
  ['amber', 'Amber', 'Time & attention', 'Turn budgets, readiness, and attention cues.'],
] as const
const games = [
  ['pink', '♞', 'Chess', 'Analyze, compete, or play together.', 'chess'],
  ['violet', '◈', 'Mafia Online', 'Private tables. Coming soon.', 'mafia'],
  ['teal', '⚑', 'Minefield', 'Every clear follows from a clue.', 'minefield'],
  ['amber', '✎', 'Paintbox', 'Make something worth keeping.', 'paintbox'],
] as const

export default function DesignSystemPage() {
  return <main className="app-surface prism-reference">
    <header className="ui-glass prism-nav">
      <Link href="/" className="prism-wordmark"><span className="ui-icon" aria-hidden><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M5.6 18.4 18.4 5.6" /></svg></span><span><strong>Prism</strong><small>Analytics Games · Design system</small></span></Link>
      <nav aria-label="Design system navigation"><a href="#foundations">Foundations</a><a href="#components">Components</a><Link href="/">Desktop ↗︎</Link></nav>
    </header>

    <section className="prism-hero">
      <div><span className="ui-badge" data-tone="pink">One system. Every app.</span><h1>Pink at heart.<br /><em>Clear by design.</em></h1><p>A shared language for play: luminous surfaces, translucent layers, and color in the content that matters.</p><div className="prism-actions"><a className="prism-action-primary" href="#components">Explore the components ↓</a><Link href="/develop">Build with Prism ↗︎</Link></div></div>
      <div className="ui-glass prism-session">
        <header><div><span className="prism-eyebrow">Colored content</span><h2>Session overview</h2></div><span className="ui-badge" data-tone="teal">Example</span></header>
        <div className="prism-metrics"><div className="ui-tone ui-metric" data-tone="pink"><span>Players</span><strong>04</strong><small>Connected</small></div><div className="ui-tone ui-metric" data-tone="violet"><span>Rounds</span><strong>02</strong><small>In this session</small></div><div className="ui-tone ui-metric" data-tone="teal"><span>Team</span><strong>Ready</strong><small>All set to play</small></div></div>
        <div className="prism-people">{[['pink', 'A', 'Ada'], ['violet', 'B', 'Ben'], ['teal', 'C', 'Cy'], ['amber', 'D', 'Dee']].map(([tone, initial, name]) => <span key={name}><b className="ui-icon" data-tone={tone}>{initial}</b>{name}</span>)}</div>
        <p>Color belongs to identity, values, and status. The surrounding material stays quiet.</p>
      </div>
    </section>

    <section id="foundations" className="prism-section">
      <div className="prism-section-title"><div><span className="prism-eyebrow">01 / Foundations</span><h2>Color has a role.</h2></div><p>Pink is the signature. Companion tones distinguish meaningful categories. Feedback and game data retain their own fixed meaning.</p></div>
      <div className="prism-tone-grid">{tones.map(([tone, name, label, detail]) => <article className="ui-tone prism-tone-card" data-tone={tone} key={tone}><span className="prism-tone-swatch" /><small>{label}</small><h3>{name}</h3><p>{detail}</p></article>)}</div>
      <div className="prism-statuses"><span className="prism-status positive">✓ Complete</span><span className="prism-status info">ⓘ Information</span><span className="prism-status warning">! Needs attention</span><span className="prism-status negative">× Action failed</span></div>
    </section>

    <section className="prism-materials prism-section">
      <div><span className="prism-eyebrow">02 / Materials</span><h2>Depth you can read.</h2><p>Frosted control layers have a translucent fill, a fine light edge, and a soft shadow. Dense content keeps a stable surface. Labels and icons always stay opaque.</p><div className="prism-preference"><MaterialPreference /><small>Saved across apps on this site. System accessibility preferences take priority.</small></div></div>
      <div className="prism-material-stage"><div className="prism-material-shape one" /><div className="prism-material-shape two" /><div className="ui-glass prism-material-sample"><span className="ui-badge" data-tone="pink">Frosted material</span><h3>Glass with a purpose.</h3><p>Navigation and floating controls sit above the content, with enough backing for comfortable reading.</p><div className="ui-card prism-solid-sample"><b>Stable content</b><span>Dense data, clues, code, and playfields use solid backing.</span></div></div></div>
    </section>

    <section id="components" className="prism-section">
      <div className="prism-section-title"><div><span className="prism-eyebrow">03 / Components</span><h2>A complete interaction language.</h2></div><p>Shape, spacing, type, focus, selection, and feedback work together. Try the controls below.</p></div>
      <div className="prism-component-grid"><article className="ui-glass prism-component-panel"><h3>Actions, selection & feedback</h3><DemoControls /></article><article className="ui-card prism-type-panel"><span className="prism-eyebrow">Type & rhythm</span><h3>Make the next move clear.</h3><p>Readable labels. Predictable groups. Space between decisions.</p><div className="prism-type-values"><span className="ui-badge" data-tone="pink">4px spacing foundation</span><span className="ui-badge" data-tone="violet">10 / 16 / 24px radii</span><span className="ui-badge" data-tone="teal">40px controls</span></div><strong className="prism-number">01:42</strong><small>Tabular numbers keep changing values steady.</small><p>Keyboard focus uses a visible outline. Selection also changes the edge and fill. Reduced motion, solid materials, and forced colors keep the system usable.</p></article></div>
    </section>

    <section className="prism-section"><div className="prism-section-title"><div><span className="prism-eyebrow">04 / In the apps</span><h2>One family. Distinct tasks.</h2></div><p>The XP desktop frames the experience. Prism shapes the useful content inside each app.</p></div><div className="prism-game-grid">{games.map(([tone, icon, title, detail, id]) => <Link href={`/games/${id}`} className="ui-tone prism-game-card" data-tone={tone} key={id}><span className="ui-icon">{icon}</span><h3>{title}</h3><p>{detail}</p><span>Open app ↗︎</span></Link>)}</div></section>

    <footer className="prism-footer"><span>Prism · Shared application design system</span><Link href="/develop">Integration guide</Link><a href="https://github.com/majorissuerep/analytics-games-service/blob/master/docs/DESIGN_SYSTEM_RESEARCH.md">Research & decisions ↗︎</a><a href="https://github.com/majorissuerep/analytics-games-service/blob/master/docs/APPLICATION_DESIGN.md">Full specification ↗︎</a></footer>
  </main>
}
