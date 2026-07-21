import Link from 'next/link'

export function PlatformHeader() {
  return (
    <header className="platform-header">
      <Link className="platform-wordmark" href="/" aria-label="Analytics Games home">
        <span className="platform-mark" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span>
          <strong>Analytics Games</strong>
          <small>shared team playground</small>
        </span>
      </Link>
      <nav className="platform-nav" aria-label="Main navigation">
        <Link href="/#games">Games</Link>
        <Link href="/develop">Build a game</Link>
      </nav>
    </header>
  )
}
