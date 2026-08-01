/**
 * Per-user Pip session memory ("remember stuff for some time").
 *
 * The client holds a random anonymous user key (localStorage); the server
 * stores the rolling transcript under a SHA-256 hash of that key, never the
 * key itself. Sessions expire after PIP_SESSION_TTL_DAYS of inactivity
 * (sliding window) and are trimmed to the most recent messages.
 *
 * When DATABASE_URL is not configured the store degrades to stateless:
 * Pip answers without memory instead of failing.
 */

import { createHash } from 'node:crypto'
import { pool } from '@/lib/db/index'
import type { PipChatMessage } from './chat'

export const PIP_SESSION_TTL_DAYS = 14
export const PIP_SESSION_MAX_MESSAGES = 12
export const PIP_SESSION_MAX_MESSAGE_CHARS = 2_000

interface Queryable {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>
}

const defaultQueryable: Queryable = {
  query: (text, values) => pool.query(text, values),
}

export function pipMemoryEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

export function hashUserKey(userKey: string): string {
  return createHash('sha256').update(`pip-session:${userKey}`).digest('hex')
}

export function trimSessionMessages(messages: PipChatMessage[]): PipChatMessage[] {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, PIP_SESSION_MAX_MESSAGE_CHARS),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-PIP_SESSION_MAX_MESSAGES)
}

export async function loadPipSession(
  keyHash: string,
  queryable: Queryable = defaultQueryable,
): Promise<PipChatMessage[]> {
  const result = await queryable.query(
    `SELECT messages FROM pip_sessions
      WHERE user_key_hash = $1 AND expires_at > NOW()`,
    [keyHash],
  )
  const raw = result.rows[0]?.messages
  if (!Array.isArray(raw)) return []
  return trimSessionMessages(raw as PipChatMessage[])
}

export async function savePipSession(
  keyHash: string,
  messages: PipChatMessage[],
  queryable: Queryable = defaultQueryable,
): Promise<void> {
  const trimmed = trimSessionMessages(messages)
  await queryable.query(
    `INSERT INTO pip_sessions (user_key_hash, messages, expires_at)
     VALUES ($1, $2, NOW() + make_interval(days => $3))
     ON CONFLICT (user_key_hash) DO UPDATE
       SET messages = EXCLUDED.messages,
           updated_at = NOW(),
           expires_at = EXCLUDED.expires_at`,
    [keyHash, JSON.stringify(trimmed), PIP_SESSION_TTL_DAYS],
  )
  // Opportunistic cleanup of expired sessions (cheap on a small table).
  await queryable.query(`DELETE FROM pip_sessions WHERE expires_at <= NOW()`)
}
