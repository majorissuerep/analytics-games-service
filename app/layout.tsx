import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Consensus Radar',
  description: "Calibrate your team's instincts. One clue. One spectrum. How close can you get?",
  keywords: ['party game', 'team game', 'consensus', 'spectrum', 'multiplayer'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
