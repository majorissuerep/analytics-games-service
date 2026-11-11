// Checks the actual SQL against isolated temporary tables, then rolls it all back.
import { Pool } from 'pg'
import { RETIRE_GAMES_SQL } from '../lib/db/retire-games.ts'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const client = await pool.connect()
try {
  await client.query('BEGIN')
  await client.query('CREATE TEMP TABLE platform_game_retirements (game_id TEXT PRIMARY KEY)')
  await client.query('CREATE TEMP TABLE game_rooms (game_id TEXT)')
  await client.query('CREATE TEMP TABLE game_leaderboard (game_id TEXT)')
  await client.query('CREATE TEMP TABLE platform_games (id TEXT)')
  for (const table of ['game_rooms','game_leaderboard']) await client.query(`INSERT INTO ${table} (game_id) VALUES ('consensus-radar'), ('chess')`)
  await client.query("INSERT INTO platform_games (id) VALUES ('consensus-radar'), ('chess')")
  await client.query(RETIRE_GAMES_SQL, [['consensus-radar']])
  await client.query(RETIRE_GAMES_SQL, [['consensus-radar']])
  for (const table of ['game_rooms','game_leaderboard']) {
    const {rows} = await client.query(`SELECT game_id FROM ${table}`)
    if (rows.length !== 1 || rows[0].game_id !== 'chess') throw new Error(`Retirement scope failed: ${table}`)
  }
  const {rows} = await client.query('SELECT id FROM platform_games')
  if (rows.length !== 1 || rows[0].id !== 'chess') throw new Error('Registration purge scope failed')
  console.log('Retirement purge is scoped and idempotent; unrelated game data preserved (temporary-table test).')
} finally { await client.query('ROLLBACK'); client.release(); await pool.end() }
