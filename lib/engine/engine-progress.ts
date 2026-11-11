/** Safe, request-scoped runtime events. No inference payloads or credentials. */
export interface EngineProgress {
  stage: 'connecting' | 'queued' | 'starting' | 'initializing' | 'thinking' | 'saving'
  message: string
  detail?: string
  depth?: number
  nodes?: number
}
export type ReportEngineProgress = (progress: EngineProgress) => void
