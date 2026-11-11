/** Atomic, one-time purge; the tombstone and targeted deletes commit together. */
export const RETIRE_GAMES_SQL = `
  WITH retired AS (
    INSERT INTO platform_game_retirements (game_id)
    SELECT unnest($1::text[])
    ON CONFLICT (game_id) DO NOTHING
    RETURNING game_id
  ), removed_scores AS (
    DELETE FROM game_leaderboard WHERE game_id IN (SELECT game_id FROM retired)
  ), removed_rooms AS (
    DELETE FROM game_rooms WHERE game_id IN (SELECT game_id FROM retired)
  )
  DELETE FROM platform_games WHERE id IN (SELECT game_id FROM retired)
`
