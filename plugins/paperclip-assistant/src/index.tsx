'use client'

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { DesktopPluginDefinition, DesktopPluginProps } from '@analytics-games/plugin-sdk'

const tips = [
  'Double-click a desktop icon to launch a game.',
  'External games can leave with the versioned bridge—or you can close their window.',
  'Game authors own gameplay. This desktop owns discovery, entry, and exit.',
  'Four teammates and one room code are enough to test a full session.',
  'A minimized game waits on the taskbar without losing its room.',
  'The Start menu knows every registered game, including remote ones.',
  'Private game data stays server-side until your role may see it.',
  'Plugins decorate the desktop; games remain isolated from them.',
  'Try the developer guide when a new game idea starts buzzing.',
  'Window close means back to the desktop—no maze of back buttons.',
  'A good clue sparks alignment without giving the answer away.',
  'Tiny games can reveal surprisingly large differences in assumptions.',
]

function randomTipAfter(current: number) {
  const randomScores = crypto.getRandomValues(new Uint32Array(tips.length))
  let selected: number | null = null

  for (let index = 0; index < tips.length; index += 1) {
    if (index === current) continue
    if (selected === null || randomScores[index] > randomScores[selected]) selected = index
  }

  return selected ?? current
}

const PIP_USER_KEY_STORAGE = 'pip-user-key'

function getOrCreateUserKey() {
  try {
    const existing = window.localStorage.getItem(PIP_USER_KEY_STORAGE)
    if (existing && /^[A-Za-z0-9-]{8,100}$/.test(existing)) return existing
    const created = crypto.randomUUID()
    window.localStorage.setItem(PIP_USER_KEY_STORAGE, created)
    return created
  } catch {
    // Storage unavailable (private mode): fall back to a per-tab key.
    return crypto.randomUUID()
  }
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
  blocked?: boolean
}

interface ToolCard {
  id: string
  name: string
  state: 'open' | 'done' | 'error'
  excerpt: string
}

/** Minimal SSE reader: emits (event, parsedData) for each `event:`/`data:` pair. */
async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: Record<string, unknown>) => void,
) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const raw = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const event = raw.match(/^event: (.+)$/m)?.[1]
        const dataLine = raw.match(/^data: (.*)$/m)?.[1]
        if (event && dataLine) {
          try {
            onEvent(event, JSON.parse(dataLine) as Record<string, unknown>)
          } catch {
            // Ignore malformed event payloads; the stream continues.
          }
        }
        boundary = buffer.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function PaperclipAssistant({ context }: DesktopPluginProps) {
  const [visible, setVisible] = useState(true)
  const [tipIndex, setTipIndex] = useState(0)
  const [chatOpen, setChatOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [userKey, setUserKey] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hi! I'm Pip. Ask me how to play, where code lives, or what this desktop can do." },
  ])
  // Live turn state (reset on every send)
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const [statusLine, setStatusLine] = useState('')
  const [toolCards, setToolCards] = useState<ToolCard[]>([])
  const [modelChip, setModelChip] = useState('')
  const reasoningRef = useRef('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  const resolveUserKey = () => {
    if (userKey) return userKey
    const created = getOrCreateUserKey()
    setUserKey(created)
    return created
  }

  useEffect(() => {
    if (chatOpen) inputRef.current?.focus()
  }, [chatOpen])

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamingText, statusLine])

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault()
    const content = draft.trim()
    if (!content || sending) return
    setMessages((current) => [...current, { role: 'user' as const, content }].slice(-12))
    setDraft('')
    setError('')
    setSending(true)
    setStreamingText(null)
    reasoningRef.current = ''
    setToolCards([])
    setStatusLine('Pip is rummaging through the repo…')
    try {
      const response = await fetch('/api/pip/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userKey: resolveUserKey(), message: content }),
      })
      if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
        const result = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(result.error || 'Pip could not answer')
      }

      let finished = false
      await readSseStream(response.body, (event, data) => {
        if (event === 'meta') {
          setModelChip(String(data.model ?? ''))
        } else if (event === 'status') {
          const text = String(data.text ?? '')
          if (text) setStatusLine(text)
        } else if (event === 'delta') {
          const chunk = String(data.text ?? '')
          if (chunk) setStreamingText((current) => (current ?? '') + chunk)
        } else if (event === 'reasoning') {
          reasoningRef.current += String(data.text ?? '')
        } else if (event === 'tool_start') {
          setToolCards((current) => [...current.slice(-2), {
            id: String(data.id ?? ''),
            name: String(data.name ?? 'tool'),
            state: 'open',
            excerpt: String(data.args ?? ''),
          }])
        } else if (event === 'tool_end') {
          setToolCards((current) => current.map((card) => card.id === String(data.id ?? '')
            ? { ...card, state: 'done', excerpt: String(data.result ?? '').slice(0, 120) }
            : card))
        } else if (event === 'blocked') {
          setMessages((current) => [...current, {
            role: 'assistant' as const,
            content: String(data.message ?? 'That one tripped my safety filter.'),
            blocked: true,
          }].slice(-12))
          finished = true
        } else if (event === 'done') {
          const text = String(data.text ?? '')
          const reasoning = reasoningRef.current.trim() ? reasoningRef.current.slice(0, 4_000) : undefined
          setStreamingText(null)
          setMessages((current) => [...current, {
            role: 'assistant' as const,
            content: text,
            ...(reasoning ? { reasoning } : {}),
          }].slice(-12))
          finished = true
        } else if (event === 'error') {
          const kind = String(data.kind ?? 'provider')
          throw new Error(kind === 'timeout'
            ? 'Pip took too long rummaging. Try again!'
            : 'Pip lost the line to the model office. Try again!')
        }
      })
      if (!finished) throw new Error('Pip lost the line to the model office. Try again!')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Pip could not answer')
    } finally {
      setSending(false)
      setStreamingText(null)
      setStatusLine('')
      reasoningRef.current = ''
    }
  }

  const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage()
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          className="paperclip-assistant"
          initial={{ opacity: 0, y: 28, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          aria-label="Pip desktop guide"
        >
          <button className="paperclip-dismiss" onClick={() => setVisible(false)} aria-label="Hide guide">×</button>
          <motion.div
            className="paperclip-character"
            animate={{ rotate: [-4, 4, -4], y: [0, -4, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          >
            <span className="paperclip-loop paperclip-loop-outer" />
            <span className="paperclip-loop paperclip-loop-inner" />
            <span className="paperclip-eye paperclip-eye-left" />
            <span className="paperclip-eye paperclip-eye-right" />
          </motion.div>
          <div className="paperclip-bubble">
            <strong>Pip says:</strong>
            <p>{tips[tipIndex]}</p>
            <div>
              <button className="pip-talk-button" onClick={() => setChatOpen(true)}>Talk to me</button>
              <button onClick={() => setTipIndex((current) => randomTipAfter(current))}>Surprise me</button>
              <button onClick={context.openHelp}>Help</button>
            </div>
          </div>
          <AnimatePresence>
            {chatOpen && (
              <motion.section
                className="pip-chat-window"
                role="dialog"
                aria-modal="false"
                aria-label="Talk to Pip"
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.97 }}
              >
                <header>
                  <div>
                    <span aria-hidden>📎</span>
                    <strong>Talk to Pip</strong>
                    <small>{modelChip ? `${modelChip} · ZDR` : 'Repo-aware · ZDR'}</small>
                  </div>
                  <button onClick={() => setChatOpen(false)} aria-label="Close Pip chat">×</button>
                </header>
                <div className="pip-chat-messages" ref={messagesRef} aria-live="polite">
                  {messages.map((message, index) => (
                    <div className={`pip-chat-message ${message.role}${message.blocked ? ' blocked' : ''}`} key={`${message.role}-${index}`}>
                      <span>{message.role === 'assistant' ? 'Pip' : 'You'}{message.blocked ? ' · 🛡' : ''}</span>
                      <p>{message.content}</p>
                      {message.reasoning && (
                        <details className="pip-chat-reasoning">
                          <summary>Pip&apos;s notes</summary>
                          <p>{message.reasoning}</p>
                        </details>
                      )}
                    </div>
                  ))}
                  {toolCards.map((card) => (
                    <div className={`pip-tool-card ${card.state}`} key={card.id} role="status">
                      <strong>
                        {card.state === 'open' ? '⏳' : card.state === 'done' ? '✓' : '✕'} {card.name}
                      </strong>
                      {card.excerpt && <small>{card.excerpt}</small>}
                    </div>
                  ))}
                  {streamingText !== null && (
                    <div className="pip-chat-message assistant streaming">
                      <span>Pip</span>
                      <p>{streamingText}<b className="pip-cursor" aria-hidden>▌</b></p>
                    </div>
                  )}
                  {sending && streamingText === null && (
                    <div className="pip-chat-thinking" role="status"><i /><i /><i /> {statusLine || 'Pip is rummaging through the repo…'}</div>
                  )}
                </div>
                <div className="pip-chat-suggestions" aria-label="Suggested questions">
                  {['How do I play Minefield?', 'Explain Consensus Radar', 'Where do games live in the repo?'].map((question) => (
                    <button key={question} onClick={() => { setDraft(question); inputRef.current?.focus() }}>{question}</button>
                  ))}
                </div>
                <form onSubmit={sendMessage}>
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={submitOnEnter}
                    maxLength={2_000}
                    rows={2}
                    placeholder="Ask about a game or the code…"
                    aria-label="Message Pip"
                  />
                  <button type="submit" disabled={sending || !draft.trim()} aria-label="Send message">➤</button>
                </form>
                {error && <p className="pip-chat-error" role="alert">{error}</p>}
                <footer>AI can make mistakes · Pip remembers this conversation for up to 14 days</footer>
              </motion.section>
            )}
          </AnimatePresence>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

export const paperclipAssistantPlugin: DesktopPluginDefinition = {
  manifest: {
    id: 'paperclip-assistant',
    version: 3,
    title: 'Pip Assistant',
    description: 'Original repo-aware AI desktop guide with a private ZDR chat.',
    slot: 'desktop-overlay',
    defaultEnabled: true,
  },
  Component: PaperclipAssistant,
}
