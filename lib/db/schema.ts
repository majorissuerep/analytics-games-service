import { pgTable, serial, text, integer, timestamp } from 'drizzle-orm/pg-core'

// Global leaderboard — one row per game submission
export const leaderboard = pgTable('leaderboard', {
  id:        serial('id').primaryKey(),
  playerId:  text('player_id').notNull(),
  name:      text('name').notNull(),
  score:     integer('score').notNull().default(0),
  rounds:    integer('rounds').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Room state — JSON blob stored as text, polled every 2s
export const rooms = pgTable('rooms', {
  code:      text('code').primaryKey(),
  hostId:    text('host_id').notNull(),
  state:     text('state').notNull().default('{}'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
