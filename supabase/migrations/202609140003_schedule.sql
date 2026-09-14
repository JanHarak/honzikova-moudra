-- Daily-plan scheduler. Requires the pg_cron extension, which must be enabled once from the
-- Supabase dashboard (Database > Extensions). This migration is resilient: if pg_cron is not yet
-- enabled it skips scheduling instead of failing the whole push, so it can be re-run after enabling.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'hm-daily-plan') then
      perform cron.unschedule('hm-daily-plan');
    end if;
    perform cron.schedule('hm-daily-plan', '*/15 * * * *', 'select public.hm_fill_daily_plan()');
  else
    raise notice 'pg_cron is not enabled; hm-daily-plan schedule was skipped. Enable pg_cron and re-run this migration.';
  end if;
end $$;
-- Push worker scheduling is configured separately with a secret in Vault; see docs/backend.md.
