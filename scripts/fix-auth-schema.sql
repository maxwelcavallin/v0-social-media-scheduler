-- Drop tabelas auth existentes (camelCase) e recriar em snake_case
-- conforme esperado pelo better-auth com Kysely adapter

-- 1. Remover tabelas antigas (com dependências primeiro)
DROP TABLE IF EXISTS post_queue CASCADE;
DROP TABLE IF EXISTS post_targets CASCADE;
DROP TABLE IF EXISTS post_media CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS social_accounts CASCADE;
DROP TABLE IF EXISTS "invitation" CASCADE;
DROP TABLE IF EXISTS "member" CASCADE;
DROP TABLE IF EXISTS "organization" CASCADE;
DROP TABLE IF EXISTS "verification" CASCADE;
DROP TABLE IF EXISTS "account" CASCADE;
DROP TABLE IF EXISTS "session" CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;

-- 2. Criar tabelas better-auth em snake_case
CREATE TABLE "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  image TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "session" (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "account" (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TIMESTAMP,
  refresh_token_expires_at TIMESTAMP,
  scope TEXT,
  password TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "verification" (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- 3. Tabelas de workspaces (em snake_case consistente)
CREATE TABLE "organization" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "member" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE TABLE "invitation" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP NOT NULL,
  inviter_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. Tabelas da aplicação
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  account_name VARCHAR(255) NOT NULL,
  account_username VARCHAR(255),
  account_id TEXT NOT NULL,
  page_id TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMP,
  profile_picture_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(platform, account_id)
);

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  scheduled_at TIMESTAMP,
  published_at TIMESTAMP,
  error_message TEXT,
  created_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video')),
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE post_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  post_type VARCHAR(20) NOT NULL DEFAULT 'feed' CHECK (post_type IN ('feed', 'reel', 'carousel', 'story')),
  platform_post_id TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, social_account_id)
);

CREATE TABLE post_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMP NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_session_user_id ON "session"(user_id);
CREATE INDEX idx_session_token ON "session"(token);
CREATE INDEX idx_account_user_id ON "account"(user_id);
CREATE INDEX idx_member_org ON "member"(organization_id);
CREATE INDEX idx_member_user ON "member"(user_id);
CREATE INDEX idx_social_workspace ON social_accounts(workspace_id);
CREATE INDEX idx_posts_workspace ON posts(workspace_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_queue_scheduled ON post_queue(scheduled_at) WHERE status = 'pending';
