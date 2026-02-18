-- Local-hosted Supabase bootstrap schema for LinkedIn Automator
-- Run this once on a fresh local database (or reset DB first).
-- Consolidated from migrations: 002,003,004,006,007,008,009.

-- -------------------------------------------------------------------
-- 002_reset_schema.sql
-- -------------------------------------------------------------------
BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS execution_logs CASCADE;
DROP TABLE IF EXISTS execution_runs CASCADE;
DROP TABLE IF EXISTS workflows CASCADE;
DROP TABLE IF EXISTS leads CASCADE;

-- LEADS TABLE
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_url TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  title TEXT,
  extra_data JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WORKFLOWS TABLE
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EXECUTION RUNS TABLE
CREATE TABLE execution_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'stopped', 'failed')),
  leads_total INTEGER DEFAULT 0,
  leads_completed INTEGER DEFAULT 0,
  leads_failed INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- EXECUTION LOGS TABLE
CREATE TABLE execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES execution_runs(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'error', 'skipped')),
  message TEXT,
  result_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Realtime publication (idempotent)
DO $$
BEGIN
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
END
$$;

-- Indexes
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_execution_logs_run_id ON execution_logs(run_id);
CREATE INDEX idx_execution_logs_created_at ON execution_logs(created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

CREATE TRIGGER trg_workflows_updated_at
BEFORE UPDATE ON workflows
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

COMMIT;

-- -------------------------------------------------------------------
-- 003_add_profiles_and_settings.sql
-- -------------------------------------------------------------------
-- LINKEDIN PROFILES
CREATE TABLE IF NOT EXISTS linkedin_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  linkedin_email        TEXT,
  adspower_profile_id   TEXT NOT NULL UNIQUE,
  brightdata_host       TEXT,
  brightdata_port       INTEGER,
  brightdata_username   TEXT,
  brightdata_password   TEXT,
  status                TEXT DEFAULT 'idle'
                        CHECK (status IN ('idle','running','paused','error')),
  daily_visit_count     INTEGER DEFAULT 0,
  daily_connect_count   INTEGER DEFAULT 0,
  daily_message_count   INTEGER DEFAULT 0,
  daily_follow_count    INTEGER DEFAULT 0,
  last_reset_date       DATE,
  last_run_at           TIMESTAMPTZ,
  avatar_color          TEXT DEFAULT '#0077b5',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- APP SETTINGS (single row)
CREATE TABLE IF NOT EXISTS app_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_visit_limit         INTEGER DEFAULT 80,
  daily_connect_limit       INTEGER DEFAULT 20,
  daily_message_limit       INTEGER DEFAULT 15,
  daily_follow_limit        INTEGER DEFAULT 30,
  min_action_delay_sec      INTEGER DEFAULT 3,
  max_action_delay_sec      INTEGER DEFAULT 12,
  min_lead_delay_sec        INTEGER DEFAULT 10,
  max_lead_delay_sec        INTEGER DEFAULT 30,
  working_hours_enabled     BOOLEAN DEFAULT true,
  working_hours_start       INTEGER DEFAULT 9,
  working_hours_end         INTEGER DEFAULT 18,
  skip_weekends             BOOLEAN DEFAULT true,
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings
);

-- ADD profile_id TO EXISTING TABLES
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES linkedin_profiles(id) ON DELETE CASCADE;

ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES linkedin_profiles(id) ON DELETE CASCADE;

ALTER TABLE execution_runs
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES linkedin_profiles(id) ON DELETE CASCADE;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_workflows_profile ON workflows(profile_id);
CREATE INDEX IF NOT EXISTS idx_leads_profile ON leads(profile_id);
CREATE INDEX IF NOT EXISTS idx_exec_runs_profile ON execution_runs(profile_id);

-- REALTIME
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE linkedin_profiles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END
$$;


-- -------------------------------------------------------------------
-- 004_profile_functions.sql
-- -------------------------------------------------------------------
-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger on linkedin_profiles
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON linkedin_profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON linkedin_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Increment a daily count on a linkedin profile
CREATE OR REPLACE FUNCTION increment_profile_count(
  p_profile_id  UUID,
  p_field       TEXT
) RETURNS void AS $$
BEGIN
  EXECUTE format(
    'UPDATE linkedin_profiles SET %I = COALESCE(%I, 0) + 1 WHERE id = $1',
    p_field, p_field
  ) USING p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset daily counts (called at midnight BD time)
CREATE OR REPLACE FUNCTION reset_daily_counts(p_profile_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE linkedin_profiles SET
    daily_visit_count   = 0,
    daily_connect_count = 0,
    daily_message_count = 0,
    daily_follow_count  = 0,
    last_reset_date     = CURRENT_DATE
  WHERE id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------------
-- 006_phase2_campaigns_unibox_login.sql
-- -------------------------------------------------------------------
-- Phase 2: Campaigns + Human Behavior + Unibox + Login/2FA + Lead Folders

-- ---------------------------------------------------------------------
-- LEAD FOLDERS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#0077b5',
  lead_count  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES lead_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_folder ON leads(folder_id);

-- ---------------------------------------------------------------------
-- CAMPAIGNS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  description         TEXT,
  status              TEXT DEFAULT 'draft'
                      CHECK (status IN ('draft','active','paused','completed','archived')),
  folder_id           UUID REFERENCES lead_folders(id) ON DELETE SET NULL,
  daily_new_leads     INTEGER DEFAULT 10,
  respect_working_hrs BOOLEAN DEFAULT true,
  total_leads         INTEGER DEFAULT 0,
  contacted_leads     INTEGER DEFAULT 0,
  replied_leads       INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES lead_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS daily_new_leads INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS respect_working_hrs BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS total_leads INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contacted_leads INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replied_leads INTEGER DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaigns_status_check'
      AND conrelid = 'campaigns'::regclass
  ) THEN
    ALTER TABLE campaigns DROP CONSTRAINT campaigns_status_check;
  END IF;

  ALTER TABLE campaigns
    ADD CONSTRAINT campaigns_status_check
    CHECK (status IN ('draft','active','paused','completed','archived'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END
$$;

CREATE TABLE IF NOT EXISTS campaign_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
  is_active     BOOLEAN DEFAULT true,
  leads_sent    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, profile_id)
);

ALTER TABLE campaign_profiles
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS leads_sent INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

UPDATE campaign_profiles
SET id = gen_random_uuid()
WHERE id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_profiles_unique
  ON campaign_profiles(campaign_id, profile_id);

CREATE TABLE IF NOT EXISTS campaign_steps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_order     INTEGER NOT NULL,
  step_type      TEXT NOT NULL
                 CHECK (step_type IN (
                   'visit_profile','send_connection','send_message',
                   'follow_profile','wait_days','check_connection','if_condition'
                 )),
  config         JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, step_order)
);

CREATE TABLE IF NOT EXISTS campaign_lead_progress (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id          UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  profile_id       UUID NOT NULL REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
  current_step     INTEGER DEFAULT 0,
  status           TEXT DEFAULT 'pending'
                   CHECK (status IN ('pending','active','waiting','completed','failed','opted_out')),
  next_action_at   TIMESTAMPTZ,
  last_action_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, lead_id)
);

ALTER TABLE campaign_lead_progress
  ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

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
    CHECK (status IN ('pending','active','waiting','completed','failed','opted_out'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END
$$;

CREATE INDEX IF NOT EXISTS idx_campaign_lead_prog ON campaign_lead_progress(next_action_at)
  WHERE status IN ('pending','waiting','active');

-- ---------------------------------------------------------------------
-- UNIBOX
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_threads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id         UUID NOT NULL REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
  lead_id            UUID REFERENCES leads(id) ON DELETE SET NULL,
  linkedin_thread_id TEXT UNIQUE,
  participant_name   TEXT,
  participant_url    TEXT,
  participant_avatar TEXT,
  last_message_text  TEXT,
  last_message_at    TIMESTAMPTZ,
  unread_count       INTEGER DEFAULT 0,
  campaign_id        UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id        UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  linkedin_msg_id  TEXT UNIQUE,
  direction        TEXT NOT NULL CHECK (direction IN ('sent','received')),
  body             TEXT NOT NULL,
  sent_at          TIMESTAMPTZ NOT NULL,
  is_read          BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threads_profile  ON message_threads(profile_id);
CREATE INDEX IF NOT EXISTS idx_threads_updated  ON message_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread  ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at DESC);

-- ---------------------------------------------------------------------
-- LOGIN CREDENTIALS / 2FA
-- ---------------------------------------------------------------------
ALTER TABLE linkedin_profiles
  ADD COLUMN IF NOT EXISTS linkedin_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_password_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS login_status TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS twofa_challenge_type TEXT,
  ADD COLUMN IF NOT EXISTS twofa_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_2fa_code TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'linkedin_profiles_login_status_check'
      AND conrelid = 'linkedin_profiles'::regclass
  ) THEN
    ALTER TABLE linkedin_profiles DROP CONSTRAINT linkedin_profiles_login_status_check;
  END IF;

  ALTER TABLE linkedin_profiles
    ADD CONSTRAINT linkedin_profiles_login_status_check
    CHECK (login_status IN ('unknown','logged_in','logged_out','2fa_pending','error'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END
$$;

-- ---------------------------------------------------------------------
-- Realtime publication (idempotent)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_threads;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE campaign_lead_progress;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE linkedin_profiles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END
$$;

-- -------------------------------------------------------------------
-- 007_master_v4_stability.sql
-- -------------------------------------------------------------------
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

-- -------------------------------------------------------------------
-- 008_schema_repair_for_app_code.sql
-- -------------------------------------------------------------------
-- Schema repair patch for runtime compatibility
-- Safe to run multiple times (idempotent)

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------------
-- Core lead folder table (required by leads.folder_id + UI routes)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#0077b5',
  lead_count  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------
-- Leads table compatibility columns used by current app/bun code
-- -------------------------------------------------------------------
ALTER TABLE IF EXISTS leads
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES lead_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS connection_degree TEXT;

UPDATE leads
SET extra_data = '{}'::jsonb
WHERE extra_data IS NULL;

ALTER TABLE leads
  ALTER COLUMN extra_data SET DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_leads_profile ON leads(profile_id);
CREATE INDEX IF NOT EXISTS idx_leads_folder ON leads(folder_id);

-- Keep legacy/new connection fields aligned where possible
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'connection_state'
  ) THEN
    UPDATE leads
    SET connection_degree = connection_state
    WHERE connection_degree IS NULL
      AND connection_state IS NOT NULL;
  END IF;
END
$$;

-- -------------------------------------------------------------------
-- linkedin_profiles login/2FA columns used by automation + UI
-- -------------------------------------------------------------------
ALTER TABLE IF EXISTS linkedin_profiles
  ADD COLUMN IF NOT EXISTS linkedin_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_password_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS login_status TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS twofa_challenge_type TEXT,
  ADD COLUMN IF NOT EXISTS twofa_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_2fa_code TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'linkedin_profiles'
      AND column_name = 'linkedin_email_login'
  ) THEN
    UPDATE linkedin_profiles
    SET linkedin_email_encrypted = linkedin_email_login
    WHERE linkedin_email_encrypted IS NULL
      AND linkedin_email_login IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'linkedin_profiles'
      AND column_name = 'linkedin_password_enc'
  ) THEN
    UPDATE linkedin_profiles
    SET linkedin_password_encrypted = linkedin_password_enc
    WHERE linkedin_password_encrypted IS NULL
      AND linkedin_password_enc IS NOT NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'linkedin_profiles_login_status_check'
      AND conrelid = 'linkedin_profiles'::regclass
  ) THEN
    ALTER TABLE linkedin_profiles DROP CONSTRAINT linkedin_profiles_login_status_check;
  END IF;

  ALTER TABLE linkedin_profiles
    ADD CONSTRAINT linkedin_profiles_login_status_check
    CHECK (login_status IN ('unknown','logged_in','logged_out','2fa_pending','error'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END
$$;

-- -------------------------------------------------------------------
-- Campaigns engine tables used by current codepaths
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  description         TEXT,
  status              TEXT DEFAULT 'draft'
                      CHECK (status IN ('draft','active','paused','completed','archived')),
  folder_id           UUID REFERENCES lead_folders(id) ON DELETE SET NULL,
  daily_new_leads     INTEGER DEFAULT 10,
  respect_working_hrs BOOLEAN DEFAULT true,
  total_leads         INTEGER DEFAULT 0,
  contacted_leads     INTEGER DEFAULT 0,
  replied_leads       INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS campaigns
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES lead_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS daily_new_leads INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS respect_working_hrs BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS total_leads INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contacted_leads INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replied_leads INTEGER DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaigns_status_check'
      AND conrelid = 'campaigns'::regclass
  ) THEN
    ALTER TABLE campaigns DROP CONSTRAINT campaigns_status_check;
  END IF;

  ALTER TABLE campaigns
    ADD CONSTRAINT campaigns_status_check
    CHECK (status IN ('draft','active','paused','completed','archived'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END
$$;

CREATE TABLE IF NOT EXISTS campaign_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
  is_active     BOOLEAN DEFAULT true,
  leads_sent    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, profile_id)
);

ALTER TABLE IF EXISTS campaign_profiles
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS leads_sent INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

UPDATE campaign_profiles
SET id = gen_random_uuid()
WHERE id IS NULL;

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
    SET is_active = CASE WHEN status IN ('paused','removed') THEN false ELSE true END
    WHERE is_active IS DISTINCT FROM CASE WHEN status IN ('paused','removed') THEN false ELSE true END;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_profiles_unique
  ON campaign_profiles(campaign_id, profile_id);

CREATE TABLE IF NOT EXISTS campaign_steps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_order     INTEGER NOT NULL,
  step_type      TEXT NOT NULL
                 CHECK (step_type IN (
                   'visit_profile','send_connection','send_message',
                   'follow_profile','wait_days','check_connection','if_condition'
                 )),
  config         JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, step_order)
);

CREATE TABLE IF NOT EXISTS campaign_lead_progress (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id          UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  profile_id       UUID NOT NULL REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
  current_step     INTEGER DEFAULT 0,
  status           TEXT DEFAULT 'pending'
                   CHECK (status IN ('pending','active','waiting','completed','failed','opted_out')),
  next_action_at   TIMESTAMPTZ,
  last_action_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, lead_id)
);

ALTER TABLE IF EXISTS campaign_lead_progress
  ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

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
    CHECK (status IN ('pending','active','waiting','completed','failed','opted_out'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END
$$;

CREATE INDEX IF NOT EXISTS idx_campaign_lead_prog ON campaign_lead_progress(next_action_at)
  WHERE status IN ('pending','waiting','active');

-- -------------------------------------------------------------------
-- Unibox tables used by current codepaths
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_threads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id         UUID NOT NULL REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
  lead_id            UUID REFERENCES leads(id) ON DELETE SET NULL,
  linkedin_thread_id TEXT UNIQUE,
  participant_name   TEXT,
  participant_url    TEXT,
  participant_avatar TEXT,
  last_message_text  TEXT,
  last_message_at    TIMESTAMPTZ,
  unread_count       INTEGER DEFAULT 0,
  campaign_id        UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id        UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  linkedin_msg_id  TEXT UNIQUE,
  direction        TEXT NOT NULL CHECK (direction IN ('sent','received')),
  body             TEXT NOT NULL,
  sent_at          TIMESTAMPTZ NOT NULL,
  is_read          BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threads_profile ON message_threads(profile_id);
CREATE INDEX IF NOT EXISTS idx_threads_updated ON message_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at DESC);

-- -------------------------------------------------------------------
-- Realtime publication bindings (idempotent)
-- -------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE leads;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE linkedin_profiles;
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
END
$$;

-- Force PostgREST schema cache refresh
NOTIFY pgrst, 'reload schema';

COMMIT;

-- -------------------------------------------------------------------
-- 009_user_id_compatibility.sql
-- -------------------------------------------------------------------
-- Compatibility patch for schemas that require user_id on app tables
-- The current app uses service-role routes without an auth session user.
-- To avoid insert failures, this patch relaxes user_id NOT NULL where present.

BEGIN;

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'leads',
    'workflows',
    'workflow_steps',
    'campaigns',
    'campaign_profiles',
    'campaign_steps',
    'campaign_lead_progress',
    'execution_runs',
    'execution_logs',
    'lead_folders',
    'message_threads',
    'messages',
    'unibox_conversations',
    'unibox_messages'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'user_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id DROP NOT NULL', tbl);
    END IF;
  END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- -------------------------------------------------------------------
-- 010_app_action_logs.sql
-- -------------------------------------------------------------------
-- App-level action audit logs
-- Tracks critical API actions (lead/profile create/update/delete/upload).

BEGIN;

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
