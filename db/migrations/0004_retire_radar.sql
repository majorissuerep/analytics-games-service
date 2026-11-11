-- Retire the removed module and purge only its room, score, and registration rows.
-- Mirrored in lib/db/ensure-schema.ts for the existing lazy schema deployment path.
BEGIN;
CREATE TABLE IF NOT EXISTS platform_game_retirements (
  game_id TEXT PRIMARY KEY,
  retired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
WITH retired AS (
  INSERT INTO platform_game_retirements (game_id) VALUES ('consensus-radar')
  ON CONFLICT (game_id) DO NOTHING RETURNING game_id
), removed_scores AS (
  DELETE FROM game_leaderboard WHERE game_id IN (SELECT game_id FROM retired)
), removed_rooms AS (
  DELETE FROM game_rooms WHERE game_id IN (SELECT game_id FROM retired)
)
DELETE FROM platform_games WHERE id IN (SELECT game_id FROM retired);
COMMIT;
