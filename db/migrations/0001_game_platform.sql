CREATE TABLE IF NOT EXISTS game_rooms (
  code       TEXT PRIMARY KEY,
  game_id    TEXT NOT NULL,
  host_id    TEXT NOT NULL,
  state      TEXT NOT NULL,
  revision   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS game_rooms_game_updated_idx
  ON game_rooms (game_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS game_leaderboard (
  id         BIGSERIAL PRIMARY KEY,
  game_id    TEXT NOT NULL,
  room_code  TEXT NOT NULL,
  player_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  score      INTEGER NOT NULL DEFAULT 0,
  rounds     INTEGER NOT NULL DEFAULT 0,
  metadata   TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, room_code, player_id)
);

CREATE INDEX IF NOT EXISTS game_leaderboard_rank_idx
  ON game_leaderboard (game_id, score DESC, updated_at ASC);
