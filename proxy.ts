import { NextResponse } from 'next/server'

/** Respond before streamed route rendering can turn a retired page into a soft 404. */
export function proxy() {
  return new NextResponse('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Game retired</title><link rel="stylesheet" href="/styles/app-theme.css"></head><body class="app-surface"><main class="ui-loading-screen"><section class="ui-card ui-loading-error"><h1>This game has been retired</h1><p>It is no longer available on this platform.</p><a href="/">Back to desktop</a></section></main></body></html>', {
    status: 410,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  })
}

// Keep this route tombstone aligned with lib/platform/retired-games.ts.
export const config = { matcher: '/games/consensus-radar/:path*' }
