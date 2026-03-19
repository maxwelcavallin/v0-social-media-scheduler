-- Remove constraint anterior se existir
ALTER TABLE public.social_accounts
  DROP CONSTRAINT IF EXISTS social_accounts_platform_account_id_unique;

-- Remove duplicatas mantendo apenas a linha mais recente por workspace_id+platform+account_id
DELETE FROM social_accounts a
USING social_accounts b
WHERE a.id < b.id
  AND a.workspace_id = b.workspace_id
  AND a.platform = b.platform
  AND a.account_id = b.account_id;

-- Adiciona constraint UNIQUE correta para o ON CONFLICT do código
ALTER TABLE public.social_accounts
  ADD CONSTRAINT social_accounts_workspace_platform_account_unique
  UNIQUE (workspace_id, platform, account_id);
