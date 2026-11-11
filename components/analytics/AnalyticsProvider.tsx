'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
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

const subscribeToPrivacyMount = (onStoreChange: () => void) => {
  const observer = new MutationObserver(onStoreChange)
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}

export function AnalyticsProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const consent = useSyncExternalStore(
    subscribeToAnalytics,
    getAnalyticsConsent,
    () => 'unknown' as const,
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const privacyButton = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const closeSettings = () => {
    setDismissed(true)
    setSettingsOpen(false)
    window.requestAnimationFrame(() => privacyButton.current?.focus())
  }
  const isTopLevel = useSyncExternalStore(
    subscribeToWindowPosition,
    () => window.self === window.top,
    () => false,
  )

  useEffect(() => {
    if (enabled && isTopLevel) initializeAnalytics(enabled)
  }, [enabled, isTopLevel])

  const desktopPrivacyMount = useSyncExternalStore(
    subscribeToPrivacyMount,
    () => document.getElementById('desktop-privacy-launcher'),
    () => null,
  )
  const privacyEntry = <button ref={privacyButton} className="app-surface analytics-settings-button" type="button" onClick={() => {
    setSettingsOpen(true)
    window.requestAnimationFrame(() => closeButton.current?.focus())
  }}>Privacy</button>

  const showDialog = Boolean(enabled && isTopLevel && ((consent === 'unknown' && !dismissed) || settingsOpen))

  return (
    <AnalyticsContext.Provider value={{ consent, configured: enabled }}>
      {children}
      {showDialog ? (
        <section
          className="app-surface analytics-consent"
          role="dialog"
          aria-label="Analytics privacy settings"
          aria-describedby="analytics-consent-summary"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              closeSettings()
            }
          }}
        >
          <header className="analytics-consent-heading">
            <div>
              <span className="analytics-consent-eyebrow">Your privacy · {consent === 'granted' ? 'Analytics on' : consent === 'denied' ? 'Analytics off' : 'No choice saved'}</span>
              <h2>Share a little. Help us improve.</h2>
            </div>
            <button ref={closeButton} className="analytics-consent-close" type="button" aria-label="Close privacy settings" onClick={closeSettings}>×</button>
          </header>
          <p id="analytics-consent-summary">Usage analytics are optional and require your consent. They help us understand which games people play.</p>
          <dl className="analytics-consent-data">
            <div><dt>Shared</dt><dd>Game launches, outcomes, play time, multiplayer activity and return visits.</dd></div>
            <div><dt>Excluded</dt><dd>Names, room codes and message content.</dd></div>
          </dl>
          <div className="analytics-consent-actions">
            <button
              type="button"
              onClick={() => {
                setAnalyticsConsent('denied')
                closeSettings()
              }}
            >
              Decline analytics
            </button>
            <button
              type="button"
              className="analytics-consent-primary"
              onClick={() => {
                setAnalyticsConsent('granted')
                closeSettings()
              }}
            >
              Accept analytics
            </button>
          </div>
          <p className="analytics-consent-note">Your choice is saved on this device. Change it anytime in Privacy.</p>
        </section>
      ) : enabled && isTopLevel ? (
        desktopPrivacyMount ? createPortal(privacyEntry, desktopPrivacyMount) : privacyEntry
      ) : null}
    </AnalyticsContext.Provider>
  )
}

export function useAnalytics() {
  return useContext(AnalyticsContext)
}
