-- Adiciona constraint única em (user_id, flag) para suportar ON CONFLICT
ALTER TABLE user_feature_flags
  ADD CONSTRAINT IF NOT EXISTS user_feature_flags_user_id_flag_key UNIQUE (user_id, flag);
