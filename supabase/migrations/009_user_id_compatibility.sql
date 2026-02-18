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
