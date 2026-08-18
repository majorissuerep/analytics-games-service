'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  getAnalyticsConsent,
  initializeAnalytics,
  setAnalyticsConsent,
  subscribeToAnalytics,
} from '@/lib/analytics/client'
import type { AnalyticsConsent } from '@/lib/analytics/controller'
import './analytics.css'

interface AnalyticsContextValue {
  consent: AnalyticsConsent
  configured: boolean
}

const AnalyticsContext = createContext<AnalyticsContextValue>({
  consent: 'unknown',
  configured: false,
})

const subscribeToWindowPosition = () => () => {}

export function AnalyticsProvider({ token, children }: { token?: string; children: ReactNode }) {
  const consent = useSyncExternalStore(
    subscribeToAnalytics,
    getAnalyticsConsent,
    () => 'unknown' as const,
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const isTopLevel = useSyncExternalStore(
    subscribeToWindowPosition,
    () => window.self === window.top,
    () => false,
  )

  useEffect(() => {
    if (token && isTopLevel) initializeAnalytics(token)
  }, [isTopLevel, token])

  const showDialog = Boolean(token && isTopLevel && (consent === 'unknown' || settingsOpen))

  return (
    <AnalyticsContext.Provider value={{ consent, configured: Boolean(token) }}>
      {children}
      {showDialog ? (
        <section className="analytics-consent" role="dialog" aria-label="Analytics privacy settings" aria-live="polite">
          <div>
            <strong>Help improve Analytics Games</strong>
            <p>Allow privacy-safe Mixpanel analytics so we can understand game launches, completions, multiplayer starts, and return visits. We never send names, room codes, or message content.</p>
          </div>
          <div className="analytics-consent-actions">
            <button
              type="button"
              onClick={() => {
                setAnalyticsConsent('denied')
                setSettingsOpen(false)
              }}
            >
              Decline analytics
            </button>
            <button
              type="button"
              className="analytics-consent-primary"
              onClick={() => {
                setAnalyticsConsent('granted')
                setSettingsOpen(false)
              }}
            >
              Accept analytics
            </button>
          </div>
        </section>
      ) : token && isTopLevel ? (
        <button className="analytics-settings-button" type="button" onClick={() => setSettingsOpen(true)}>
          Privacy
        </button>
      ) : null}
    </AnalyticsContext.Provider>
  )
}

export function useAnalytics() {
  return useContext(AnalyticsContext)
}
