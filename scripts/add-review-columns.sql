-- Adiciona colunas de revisão na tabela posts
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS review_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS review_status TEXT CHECK (review_status IN ('in_review', 'approved', 'needs_changes')) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS review_notes TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS review_at TIMESTAMPTZ DEFAULT NULL;

-- Índice para busca rápida por token
CREATE UNIQUE INDEX IF NOT EXISTS posts_review_token_idx ON posts (review_token) WHERE review_token IS NOT NULL;
