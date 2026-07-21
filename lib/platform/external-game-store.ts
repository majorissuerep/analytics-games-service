import 'server-only'

import { ensurePlatformSchema } from '@/lib/db/ensure-schema'
import { pool } from '@/lib/db/index'
import type { GameManifest } from '@/lib/engine/types'
import { parseExternalGameManifest } from './external-game-schema'

interface ExternalGameRow {
  manifest: string
}

export async function listExternalGames(): Promise<GameManifest[]> {
  await ensurePlatformSchema()
  const result = await pool.query<ExternalGameRow>(
    `SELECT manifest FROM platform_games WHERE enabled = TRUE ORDER BY title ASC`,
  )
  return result.rows.flatMap((row) => {
    try {
      return [parseExternalGameManifest(JSON.parse(row.manifest))]
    } catch (error) {
      console.error('Skipping invalid external game manifest', error)
      return []
    }
  })
}

export async function upsertExternalGame(value: unknown): Promise<GameManifest> {
  const manifest = parseExternalGameManifest(value)
  await ensurePlatformSchema()
  await pool.query(
    `
      INSERT INTO platform_games (id, title, manifest, enabled, updated_at)
      VALUES ($1, $2, $3, TRUE, NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        manifest = EXCLUDED.manifest,
        enabled = TRUE,
        updated_at = NOW()
    `,
    [manifest.id, manifest.title, JSON.stringify(manifest)],
  )
  return manifest
}

export async function disableExternalGame(id: string): Promise<boolean> {
  await ensurePlatformSchema()
  const result = await pool.query(
    `UPDATE platform_games SET enabled = FALSE, updated_at = NOW() WHERE id = $1`,
    [id],
  )
  return (result.rowCount ?? 0) > 0
}
