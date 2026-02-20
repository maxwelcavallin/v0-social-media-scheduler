-- Social Media Scheduling Platform - Database Setup
-- Este script cria as tabelas necessárias para o sistema de agendamento de posts

-- 1. Social Accounts (Contas conectadas via Meta OAuth)
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES neon_auth.organization(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  account_name VARCHAR(255) NOT NULL,
  account_username VARCHAR(255), -- @username da conta
  account_id TEXT NOT NULL, -- ID da conta na plataforma (Page ID ou Instagram Account ID)
  page_id TEXT, -- Facebook Page ID (preenchido para ambas plataformas pois Instagram precisa estar conectado a uma Page)
  access_token TEXT NOT NULL, -- Page Access Token (criptografado) - usado para Facebook e Instagram
  token_expires_at TIMESTAMP, -- Tokens de página não expiram, mas user token sim
  profile_picture_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP, -- Última vez que sincronizamos dados desta conta
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(platform, account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_workspace ON social_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_page ON social_accounts(page_id);

-- 2. Posts (Posts agendados/publicados)
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES neon_auth.organization(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES neon_auth.user(id),
  content TEXT NOT NULL, -- Legenda
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  scheduled_at TIMESTAMP,
  published_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_workspace ON posts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at) WHERE status = 'scheduled';

-- 3. Post Media (Mídia dos posts)
CREATE TABLE IF NOT EXISTS post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL, -- URL do Vercel Blob
  media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video')),
  file_size BIGINT,
  mime_type VARCHAR(100),
  width INTEGER,
  height INTEGER,
  duration INTEGER, -- Para vídeos
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_media_post ON post_media(post_id);

-- 4. Post Targets (Onde publicar)
CREATE TABLE IF NOT EXISTS post_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  post_type VARCHAR(20) NOT NULL CHECK (post_type IN ('feed', 'story', 'reel', 'carousel')),
  platform_post_id TEXT, -- ID do post após publicação
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'publishing', 'published', 'failed')),
  error_message TEXT,
  published_at TIMESTAMP,
  -- Metadados específicos da plataforma
  location_id TEXT,
  location_name TEXT,
  tagged_users JSONB, -- Array de usernames/IDs
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, social_account_id)
);

CREATE INDEX IF NOT EXISTS idx_post_targets_post ON post_targets(post_id);
CREATE INDEX IF NOT EXISTS idx_post_targets_account ON post_targets(social_account_id);
CREATE INDEX IF NOT EXISTS idx_post_targets_status ON post_targets(status);

-- 5. Post Queue (Fila de processamento)
CREATE TABLE IF NOT EXISTS post_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_target_id UUID NOT NULL REFERENCES post_targets(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMP NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMP,
  next_retry_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_queue_scheduled ON post_queue(scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_post_queue_retry ON post_queue(next_retry_at) WHERE status = 'pending';

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_social_accounts_updated_at BEFORE UPDATE ON social_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
