-- Adiciona índice único em (user_id, flag) para suportar ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS user_feature_flags_user_id_flag_key
  ON user_feature_flags (user_id, flag);
