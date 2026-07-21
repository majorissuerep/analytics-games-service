import { Pool } from 'pg'

const globalForDatabase = globalThis as typeof globalThis & {
  analyticsGamesPool?: Pool
}

export const pool = globalForDatabase.analyticsGamesPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
})

if (process.env.NODE_ENV !== 'production') globalForDatabase.analyticsGamesPool = pool
