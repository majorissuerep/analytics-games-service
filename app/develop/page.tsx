import Link from 'next/link'
import { PlatformHeader } from '@/components/platform/PlatformHeader'

const steps = [
  ['01', 'Host it', 'Deploy any browser game on its own HTTPS origin. Any framework works.'],
  ['02', 'Bridge it', 'Send game.ready; receive host.init; send game.exit when player leaves.'],
  ['03', 'Describe it', 'Register strict title, URL, origin, player range, and discovery metadata.'],
  ['04', 'Ship freely', 'Keep repository, release cadence, backend, and visual stack independent.'],
]

export default function DevelopGamePage() {
  return (
    <main className="platform-shell developer-shell">
      <PlatformHeader />
      <section className="developer-hero">
        <span className="platform-kicker"><span /> Game integration guide</span>
        <h1>Host anywhere.<br /><em>Return to one desktop.</em></h1>
        <p>
          External URL games need only bridge v1. Internal games may additionally use shared rooms,
          actions, private projections, and leaderboards.
        </p>
      </section>

      <section className="developer-steps">
        {steps.map(([number, title, detail]) => (
          <article key={number}>
            <span>{number}</span>
            <h2>{title}</h2>
            <p>{detail}</p>
          </article>
        ))}
      </section>

      <section className="developer-code">
        <div>
          <span className="platform-kicker"><span /> External bridge v1</span>
          <h2>Three messages. No framework coupling.</h2>
          <p>Every message uses exact origins and a versioned browser-native contract.</p>
        </div>
        <pre><code>{`parent.postMessage(readyMessage(), PLATFORM_ORIGIN)

addEventListener('message', event => {
  if (event.origin !== PLATFORM_ORIGIN) return
  if (event.data.type === 'host.init') start(event.data.payload)
})

parent.postMessage(exitMessage('complete'), PLATFORM_ORIGIN)`}</code></pre>
      </section>

      <section className="developer-register">
        <div>
          <span>REMOTE SDK</span>
          <code>packages/game-bridge</code>
        </div>
        <div>
          <span>REGISTRATION</span>
          <code>POST /api/platform/games</code>
        </div>
        <div>
          <span>INTERNAL SAMPLE</span>
          <code>games/consensus-radar</code>
        </div>
      </section>

      <div className="developer-back">
        <Link href="/">← Back to games</Link>
      </div>
    </main>
  )
}
