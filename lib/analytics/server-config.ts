export function eventTrackingEnabled() {
  return process.env.EVENT_TRACKING_ENABLED === 'true'
}

export function eventTrackingConfigured() {
  return eventTrackingEnabled() && Boolean(process.env.EVENT_WRITE_KEY)
}
