-- ─────────────────────────────────────────────────────
-- LEAD FOLDERS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_folders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  lead_count    INTEGER DEFAULT 0,
  color         TEXT DEFAULT '#6366f1',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Leads now have an optional folder_id
ALTER TABLE leads ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES lead_folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_leads_folder ON leads(folder_id);

-- ─────────────────────────────────────────────────────
-- CAMPAIGNS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  status          TEXT DEFAULT 'draft'
                  CHECK (status IN ('draft','active','paused','completed','archived')),
  sequence        JSONB NOT NULL DEFAULT '[]',
  daily_new_leads INTEGER DEFAULT 20,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Many-to-many: campaign <-> linkedin_profiles
CREATE TABLE IF NOT EXISTS campaign_profiles (
  campaign_id  UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  profile_id   UUID REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'active' CHECK (status IN ('active','paused','removed')),
  PRIMARY KEY (campaign_id, profile_id)
);

-- Many-to-many: campaign <-> lead_folders
CREATE TABLE IF NOT EXISTS campaign_lead_folders (
  campaign_id    UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  folder_id      UUID REFERENCES lead_folders(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, folder_id)
);

-- Track each lead's progress through a campaign sequence
CREATE TABLE IF NOT EXISTS campaign_lead_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id) ON DELETE CASCADE,
  profile_id      UUID REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
  current_step    INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','waiting','completed','failed','skipped')),
  next_action_at  TIMESTAMPTZ,
  last_action_at  TIMESTAMPTZ,
  step_results    JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, lead_id)
);
CREATE INDEX IF NOT EXISTS idx_clp_next_action ON campaign_lead_progress(next_action_at) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_clp_campaign    ON campaign_lead_progress(campaign_id);
CREATE INDEX IF NOT EXISTS idx_clp_profile     ON campaign_lead_progress(profile_id);

-- ─────────────────────────────────────────────────────
-- UNIBOX: CONVERSATIONS & MESSAGES
-- ─────────────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_unibox_conv_profile ON unibox_conversations(profile_id);
CREATE INDEX IF NOT EXISTS idx_unibox_msg_conv     ON unibox_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_unibox_msg_sent     ON unibox_messages(sent_at DESC);

-- ─────────────────────────────────────────────────────
-- 2FA AUTH EVENTS (realtime channel for 2FA relay)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN ('login_required','2fa_required','2fa_submitted','login_success','login_failed')),
  payload     JSONB DEFAULT '{}',
  code        TEXT,
  resolved    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_events_profile ON auth_events(profile_id, resolved);

-- Add credential columns to linkedin_profiles
ALTER TABLE linkedin_profiles
  ADD COLUMN IF NOT EXISTS linkedin_email_login     TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_password_enc    TEXT,
  ADD COLUMN IF NOT EXISTS session_valid            BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at            TIMESTAMPTZ;

-- Realtime (idempotent)
DO $$
BEGIN
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

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE campaign_lead_progress;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END
$$;
