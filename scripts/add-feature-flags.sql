CREATE TABLE IF NOT EXISTS user_feature_flags (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flag      TEXT NOT NULL,
  enabled   BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, flag)
);
