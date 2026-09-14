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

const subscribeToWindowPosition = (onStoreChange: () => void) => {
  const frame = window.requestAnimationFrame(onStoreChange)
  return () => window.cancelAnimationFrame(frame)
}

export function AnalyticsProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
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
    if (enabled && isTopLevel) initializeAnalytics(enabled)
  }, [enabled, isTopLevel])

  const showDialog = Boolean(enabled && isTopLevel && (consent === 'unknown' || settingsOpen))

  return (
    <AnalyticsContext.Provider value={{ consent, configured: enabled }}>
      {children}
      {showDialog ? (
        <section className="analytics-consent" role="dialog" aria-label="Analytics privacy settings" aria-live="polite">
          <div>
            <strong>Help improve Analytics Games</strong>
            <p>Allow privacy-safe self-hosted analytics so we can understand game launches, completions, multiplayer starts, and return visits. We never send names, room codes, or message content.</p>
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
      ) : enabled && isTopLevel ? (
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
