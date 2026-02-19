BEGIN;

ALTER TABLE IF EXISTS app_settings
  ADD COLUMN IF NOT EXISTS vision_ai_model TEXT DEFAULT 'openai/gpt-4o-mini';

UPDATE app_settings
SET vision_ai_model = 'openai/gpt-4o-mini'
WHERE vision_ai_model IS NULL OR btrim(vision_ai_model) = '';

COMMIT;
