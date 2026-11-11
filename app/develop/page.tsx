import Link from 'next/link'
import './develop.css'
import { PlatformHeader } from '@/components/platform/PlatformHeader'

const steps = [
  ['host', '01', 'Host your game', 'Deploy any browser game on its own HTTPS origin. Any framework works.'],
  ['bridge', '02', 'Connect the bridge', 'Send game.ready, receive host.init, then send game.exit when the player leaves.'],
  ['register', '03', 'Register the manifest', 'Describe the title, URL, origin, player range, and discovery metadata.'],
  ['theme', '04', 'Style the application', 'Give your app its own personality on the shared interaction engine.'],
]

export default function DevelopGamePage() {
  return (
    <main className="app-surface platform-shell developer-shell">
      <PlatformHeader />
      <a className="developer-skip" href="#guide-content">Skip to integration guide</a>
      <div className="developer-workbench">
        <nav className="developer-index ui-glass" aria-label="Integration steps">
          <span className="developer-label">IN THIS GUIDE</span>
          <ol>{steps.map(([id, number, title]) => <li key={id}><a href={`#${id}`}><span>{number}</span>{title}</a></li>)}</ol>
          <div className="developer-index-note"><span className="developer-label">CONTRACT</span><strong>External bridge v1</strong><p>No framework coupling.<br />Exact origins. Versioned messages.</p></div>
          <Link href="/design-system">Prism reference ↗</Link>
        </nav>
        <div className="developer-document" id="guide-content" tabIndex={-1}>
          <header className="developer-hero">
            <span className="developer-label">DEVELOPER MANUAL / INTEGRATION</span>
            <h1>Bring a game<br />to the desktop.</h1>
            <p>Host it anywhere. Connect it with bridge v1. External URL games need only the bridge; internal games may additionally use shared rooms, actions, private projections, and leaderboards.</p>
            <div className="developer-path"><span>HTTPS game</span><span aria-hidden>→</span><span>Bridge v1</span><span aria-hidden>→</span><strong>Desktop</strong></div>
          </header>

          <section className="developer-section" id="host" aria-labelledby="host-heading">
            <div className="developer-section-title"><span>01</span><h2 id="host-heading">Host your game</h2></div>
            <p>Deploy your browser game on its own HTTPS origin. Keep the launch URL and declared origin aligned. The desktop supplies the window; your game owns the content inside it.</p>
            <dl className="developer-reference"><div><dt>Launch URL</dt><dd>HTTPS, with an origin matching the manifest</dd></div><div><dt>Runtime</dt><dd>Any browser framework</dd></div><div><dt>Integration</dt><dd><code>external</code> · bridge version <code>1</code></dd></div></dl>
          </section>

          <section className="developer-section" id="bridge" aria-labelledby="bridge-heading">
            <div className="developer-section-title"><span>02</span><h2 id="bridge-heading">Connect the bridge</h2></div>
            <p>Listen before announcing readiness. Validate the host origin and versioned message contract, start from <code>host.init</code>, and signal when the player leaves.</p>
            <div className="developer-code"><div className="developer-code-label"><span>Browser / TypeScript</span><code>@analytics-games/game-bridge</code></div><pre tabIndex={0} aria-label="Bridge integration code"><code>{`import { readyMessage, exitMessage } from '@analytics-games/game-bridge'

// Set this to the exact origin of the platform hosting your game.
const PLATFORM_ORIGIN = 'https://analytics-games-service.vercel.app'

addEventListener('message', event => {
  if (event.origin !== PLATFORM_ORIGIN || event.source !== parent) return
  const message = event.data
  if (message?.protocol !== 'analytics-games.bridge') return
  if (message.version !== 1 || message.type !== 'host.init') return
  start(message.payload) // Your game's initialization function
})

parent.postMessage(readyMessage(), PLATFORM_ORIGIN)

// Call from your game's completion / leave handler.
function leaveGame() {
  parent.postMessage(exitMessage('complete'), PLATFORM_ORIGIN)
}`}</code></pre></div>
            <p className="developer-note">Send the exit message from your game’s leave handler. Use <code>cancel</code> or <code>error</code> for those exit reasons. The SDK source is <code>packages/game-bridge</code>.</p>
          </section>

          <section className="developer-section" id="register" aria-labelledby="register-heading">
            <div className="developer-section-title"><span>03</span><h2 id="register-heading">Register the manifest</h2></div>
            <p>Register strict title, URL, origin, player range, and discovery metadata with the platform administrator. Preserve the game’s instructions in its manifest.</p>
            <div className="developer-endpoint"><span>POST</span><code>/api/platform/games</code></div>
            <dl className="developer-reference"><div><dt>Authorization</dt><dd>Administrator bearer token; keep it server-side</dd></div><div><dt>Validation</dt><dd>Strict manifest schema; matching origins; minimum players ≤ maximum players</dd></div><div><dt>Responses</dt><dd><code>201</code> registered · <code>400</code> invalid manifest · <code>403</code> forbidden · <code>503</code> registration disabled</dd></div><div><dt>Repository references</dt><dd><code>lib/platform/external-game-schema.ts</code><br /><code>games/chess</code> (internal sample)</dd></div></dl>
          </section>

          <section className="developer-section developer-theme" id="theme" aria-labelledby="theme-heading">
            <div className="developer-section-title"><span>04</span><h2 id="theme-heading">Build with Prism</h2></div>
            <p>Share the accessibility and interaction engine: readable type, spacing, focus, control states, scoped progress, and reduced motion/transparency. Your app owns its composition and material character.</p>
            <p>Scope <code>--ui-*</code> overrides to your app’s <code>app-surface</code> root. Use a small neutral ramp and at most two decorative color families, normally pink intent plus one optional identity. Semantic feedback and essential game colors are exceptions with fixed meaning.</p>
            <p>Use bounded frost for navigation or controls and stable opaque surfaces for dense content. The desktop supplies the XP frame.</p>
            <div className="developer-code"><div className="developer-code-label"><span>Application shell / HTML</span></div><pre tabIndex={0} aria-label="Shared application theme code"><code>{`<link rel="stylesheet" href="https://analytics-games-service.vercel.app/styles/app-theme.css">
<main class="app-surface my-game">
  <header class="ui-glass">Your game controls</header>
  <section class="ui-card">
    <span>Players ready</span><strong>04</strong>
  </section>
  <button class="ui-primary">Start game</button>
</main>`}</code></pre></div>
            <Link className="developer-reference-link" href="/design-system">Explore foundations and live components →</Link>
          </section>
          <footer className="developer-back"><Link href="/">← Back to games</Link><a href="#guide-content">Back to top ↑</a></footer>
        </div>
      </div>
    </main>
  )
}
