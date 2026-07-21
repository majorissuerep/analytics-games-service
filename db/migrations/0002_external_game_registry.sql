CREATE TABLE IF NOT EXISTS platform_games (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  manifest   TEXT NOT NULL,
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_games_enabled_title_idx
  ON platform_games (enabled, title);
