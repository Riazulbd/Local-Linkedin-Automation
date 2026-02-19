-- Adds a tunable speed multiplier used by bun-server delay helpers.
-- Safe to run multiple times.

BEGIN;

ALTER TABLE IF EXISTS app_settings
  ADD COLUMN IF NOT EXISTS speed_multiplier DOUBLE PRECISION DEFAULT 1.0;

UPDATE app_settings
SET speed_multiplier = 1.0
WHERE speed_multiplier IS NULL;

ALTER TABLE IF EXISTS app_settings
  ALTER COLUMN speed_multiplier SET DEFAULT 1.0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_speed_multiplier_check'
      AND conrelid = 'app_settings'::regclass
  ) THEN
    ALTER TABLE app_settings DROP CONSTRAINT app_settings_speed_multiplier_check;
  END IF;

  ALTER TABLE app_settings
    ADD CONSTRAINT app_settings_speed_multiplier_check
    CHECK (speed_multiplier >= 0.5 AND speed_multiplier <= 3.0);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
