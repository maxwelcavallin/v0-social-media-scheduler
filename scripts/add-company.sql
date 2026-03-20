-- Tabela principal de empresa (unidade acima dos workspaces)
CREATE TABLE IF NOT EXISTS company (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL,
  document    TEXT,
  document_type TEXT CHECK (document_type IN ('cpf', 'cnpj')),
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Membros da empresa
CREATE TABLE IF NOT EXISTS company_member (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id  TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, user_id)
);

-- Convites pendentes por e-mail
CREATE TABLE IF NOT EXISTS company_invitation (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id  TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  token       TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  invited_by  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, email)
);

-- Adicionar company_id em organization (workspace)
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES company(id) ON DELETE SET NULL;

-- Adicionar company_id em user_subscriptions
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES company(id) ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_company_member_user     ON company_member(user_id);
CREATE INDEX IF NOT EXISTS idx_company_member_company  ON company_member(company_id);
CREATE INDEX IF NOT EXISTS idx_company_invitation_token ON company_invitation(token);
CREATE INDEX IF NOT EXISTS idx_company_invitation_email ON company_invitation(email);
CREATE INDEX IF NOT EXISTS idx_organization_company    ON "organization"(company_id);
