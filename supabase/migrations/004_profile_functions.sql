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
