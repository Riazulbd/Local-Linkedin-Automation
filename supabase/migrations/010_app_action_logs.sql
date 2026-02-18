-- App-level action audit logs
-- Tracks critical API actions (lead/profile create/update/delete/upload).

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS app_action_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type   TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT,
  status        TEXT NOT NULL CHECK (status IN ('success', 'error')),
  request_data  JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_action_logs_created_at
  ON app_action_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_action_logs_action_status
  ON app_action_logs(action_type, status, created_at DESC);

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE app_action_logs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
