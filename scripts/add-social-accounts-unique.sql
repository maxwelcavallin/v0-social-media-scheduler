-- Remove duplicatas mantendo apenas a linha mais recente por platform+account_id
DELETE FROM social_accounts a
USING social_accounts b
WHERE a.id < b.id
  AND a.platform = b.platform
  AND a.account_id = b.account_id;

-- Adiciona constraint UNIQUE para permitir ON CONFLICT
ALTER TABLE public.social_accounts
  ADD CONSTRAINT social_accounts_platform_account_id_unique
  UNIQUE (platform, account_id);
