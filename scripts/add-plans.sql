-- Tabela de assinaturas de usuários
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_user_id_idx ON user_subscriptions(user_id);

-- Inserir plano free para todos os usuários existentes
INSERT INTO user_subscriptions (user_id, plan, status)
SELECT id, 'free', 'active' FROM users
ON CONFLICT (user_id) DO NOTHING;
