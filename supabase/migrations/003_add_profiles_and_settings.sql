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

