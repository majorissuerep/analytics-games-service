import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Analytics Games',
    template: '%s · Analytics Games',
  },
  description: 'A shared web platform for small multiplayer games built by analytics teams.',
  keywords: ['analytics', 'team games', 'multiplayer', 'facilitation'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AnalyticsProvider token={process.env.MIXPANEL_PROJECT_TOKEN}>
          {children}
        </AnalyticsProvider>
        <Analytics />
      </body>
    </html>
  )
}
