'use client'

import Link from 'next/link'

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="app-surface ui-loading-screen"><section className="ui-card ui-loading-error" role="alert"><h1>This page could not load</h1><p>Try again, or return to the desktop.</p><button className="ui-primary" onClick={reset}>Try again</button><Link href="/">Back to desktop</Link></section></main>
}
