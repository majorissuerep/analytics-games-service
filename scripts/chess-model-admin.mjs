#!/usr/bin/env node
const [command, ...args] = process.argv.slice(2)
const base = process.env.CHESS_MODEL_ADMIN_BASE_URL ?? 'https://analytics-games-service.vercel.app'
const token = process.env.CHESS_MODEL_ADMIN_TOKEN
if (!token) throw new Error('CHESS_MODEL_ADMIN_TOKEN is required')

async function request(path, init = {}) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
  const body = await response.json()
  if (!response.ok) throw new Error(`${response.status}: ${body.error ?? JSON.stringify(body)}`)
  console.log(JSON.stringify(body, null, 2))
}

if (command === 'list') {
  await request('/api/admin/chess-models')
} else if (command === 'approve' && args.length === 2) {
  await request(`/api/admin/chess-models/${args[0]}/revisions/${args[1]}/decision`, { method: 'POST', body: JSON.stringify({ decision: 'approve' }) })
} else if (command === 'reject' && args.length >= 3) {
  await request(`/api/admin/chess-models/${args[0]}/revisions/${args[1]}/decision`, { method: 'POST', body: JSON.stringify({ decision: 'reject', reason: args.slice(2).join(' ') }) })
} else if (command === 'rename' && args.length >= 2) {
  await request(`/api/admin/chess-models/${args[0]}`, { method: 'PATCH', body: JSON.stringify({ displayName: args.slice(1).join(' ') }) })
} else {
  console.error('Usage: chess-model-admin.mjs list | approve MODEL_ID REVISION_ID | reject MODEL_ID REVISION_ID REASON | rename MODEL_ID DISPLAY_NAME')
  process.exit(2)
}
