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
