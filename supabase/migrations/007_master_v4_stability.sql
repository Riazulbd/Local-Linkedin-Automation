-- Master V4 stability patch (non-destructive / idempotent)
-- Applies only missing columns, constraints, indexes, and realtime bindings.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------------
-- linkedin_profiles: auth/session compatibility columns
-- -------------------------------------------------------------------
ALTER TABLE IF EXISTS linkedin_profiles
  ADD COLUMN IF NOT EXISTS linkedin_email_login TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_password_enc TEXT,
  ADD COLUMN IF NOT EXISTS session_valid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- -------------------------------------------------------------------
-- campaigns: ensure sequence + operational columns exist
-- -------------------------------------------------------------------
ALTER TABLE IF EXISTS campaigns
  ADD COLUMN IF NOT EXISTS sequence JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES lead_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS daily_new_leads INTEGER DEFAULT 20;

-- -------------------------------------------------------------------
-- campaign_profiles: normalize active flag
-- -------------------------------------------------------------------
ALTER TABLE IF EXISTS campaign_profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'campaign_profiles'
      AND column_name = 'status'
  ) THEN
    UPDATE campaign_profiles
    SET is_active = CASE
      WHEN status IN ('paused', 'removed') THEN false
      ELSE true
    END
    WHERE is_active IS DISTINCT FROM CASE
      WHEN status IN ('paused', 'removed') THEN false
      ELSE true
    END;
  END IF;
END
$$;

-- -------------------------------------------------------------------
-- campaign_lead_progress: broaden status compatibility
-- -------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaign_lead_progress_status_check'
      AND conrelid = 'campaign_lead_progress'::regclass
  ) THEN
    ALTER TABLE campaign_lead_progress DROP CONSTRAINT campaign_lead_progress_status_check;
  END IF;

  ALTER TABLE campaign_lead_progress
    ADD CONSTRAINT campaign_lead_progress_status_check
    CHECK (status IN ('pending','active','in_progress','waiting','completed','failed','opted_out','skipped'));
EXCEPTION WHEN undefined_table THEN
  NULL;
WHEN duplicate_object THEN
  NULL;
END
$$;

-- -------------------------------------------------------------------
-- execution_runs + execution_logs: test/logging upgrades
-- -------------------------------------------------------------------
ALTER TABLE IF EXISTS execution_runs
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS execution_logs
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'execution_logs_status_check'
      AND conrelid = 'execution_logs'::regclass
  ) THEN
    ALTER TABLE execution_logs DROP CONSTRAINT execution_logs_status_check;
  END IF;

  ALTER TABLE execution_logs
    ADD CONSTRAINT execution_logs_status_check
    CHECK (status IN ('running','success','error','skipped','info'));
EXCEPTION WHEN undefined_table THEN
  NULL;
WHEN duplicate_object THEN
  NULL;
END
$$;

CREATE INDEX IF NOT EXISTS idx_exec_logs_test
  ON execution_logs(is_test)
  WHERE is_test = true;

-- -------------------------------------------------------------------
-- lead connection-degree tracking
-- -------------------------------------------------------------------
ALTER TABLE IF EXISTS leads
  ADD COLUMN IF NOT EXISTS connection_degree TEXT;

-- -------------------------------------------------------------------
-- Unibox compatibility aliases (message_threads/messages already used)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unibox_conversations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            UUID REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
  linkedin_thread_id    TEXT NOT NULL,
  contact_name          TEXT,
  contact_linkedin_url  TEXT,
  contact_headline      TEXT,
  last_message_text     TEXT,
  last_message_at       TIMESTAMPTZ,
  unread_count          INTEGER DEFAULT 0,
  last_synced_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, linkedin_thread_id)
);

CREATE TABLE IF NOT EXISTS unibox_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID REFERENCES unibox_conversations(id) ON DELETE CASCADE,
  linkedin_message_id TEXT,
  sender_name         TEXT,
  sender_is_me        BOOLEAN DEFAULT false,
  body                TEXT NOT NULL,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, linkedin_message_id)
);

CREATE INDEX IF NOT EXISTS idx_unibox_conv_profile
  ON unibox_conversations(profile_id);

CREATE INDEX IF NOT EXISTS idx_unibox_msg_conv
  ON unibox_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_unibox_msg_sent
  ON unibox_messages(sent_at DESC);

-- -------------------------------------------------------------------
-- Auth events relay table
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN (
    'login_required','2fa_required','2fa_submitted','login_success','login_failed'
  )),
  payload     JSONB DEFAULT '{}',
  code        TEXT,
  resolved    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_profile
  ON auth_events(profile_id, resolved);

-- -------------------------------------------------------------------
-- Realtime publication bindings (idempotent)
-- -------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE linkedin_profiles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE execution_logs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE execution_runs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE leads;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE campaign_lead_progress;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_threads;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE unibox_conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE unibox_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE auth_events;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END
$$;

COMMIT;
