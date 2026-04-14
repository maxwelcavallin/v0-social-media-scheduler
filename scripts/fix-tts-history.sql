-- Adiciona colunas que as APIs esperam (caso não existam)
ALTER TABLE tts_history ADD COLUMN IF NOT EXISTS text_preview TEXT;
ALTER TABLE tts_history ADD COLUMN IF NOT EXISTS full_text TEXT;
ALTER TABLE tts_history ADD COLUMN IF NOT EXISTS voice_name TEXT;
ALTER TABLE tts_history ADD COLUMN IF NOT EXISTS config JSONB;

-- Preenche text_preview a partir de text (coluna original) se existir
UPDATE tts_history SET text_preview = LEFT(text, 200) WHERE text_preview IS NULL AND text IS NOT NULL;
UPDATE tts_history SET full_text = text WHERE full_text IS NULL AND text IS NOT NULL;
UPDATE tts_history SET voice_name = voice WHERE voice_name IS NULL AND voice IS NOT NULL;
