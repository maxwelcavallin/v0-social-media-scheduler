-- Adiciona colunas para controle de limpeza de mídia após 60 dias
ALTER TABLE post_media
  ADD COLUMN IF NOT EXISTS preview_url TEXT,
  ADD COLUMN IF NOT EXISTS cleaned_at TIMESTAMP WITHOUT TIME ZONE;

-- Índice para o cron encontrar rapidamente as mídias elegíveis
CREATE INDEX IF NOT EXISTS post_media_cleanup_idx
  ON post_media (created_at)
  WHERE cleaned_at IS NULL;
