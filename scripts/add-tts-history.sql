CREATE TABLE IF NOT EXISTS tts_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  voice TEXT NOT NULL,
  voice_style TEXT,
  voice_maturity TEXT,
  narrative_role TEXT,
  tone TEXT,
  audio_url TEXT,
  duration_seconds NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tts_history_user_idx ON tts_history(user_id, created_at DESC);
