-- Tabela de vozes personalizadas por workspace (clone + favoritas)
CREATE TABLE IF NOT EXISTS tts_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- "clone" = voz clonada via upload de amostras | "preset" = voz Gemini salva como favorita
  type TEXT NOT NULL DEFAULT 'preset' CHECK (type IN ('clone', 'preset')),
  -- Para preset: nome da voz Gemini
  base_voice TEXT,
  -- Para preset: configurações salvas
  voice_style TEXT,
  voice_maturity TEXT,
  narrative_role TEXT,
  tonality TEXT,
  -- Para clone: arquivos de amostra armazenados no Blob (array JSON de URLs)
  sample_urls JSONB DEFAULT '[]',
  -- Preview de áudio gerado para a voz clonada
  preview_url TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tts_voices_workspace ON tts_voices(workspace_id);
