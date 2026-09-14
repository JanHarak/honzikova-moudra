-- Run the push worker automatically. The URL and bearer secret are stored in
-- Supabase Vault and must be created once before this schedule can deliver pushes.
create extension if not exists pg_net;

create or replace function public.hm_trigger_push_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  worker_secret text;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'hm_supabase_url';

  select decrypted_secret into worker_secret
  from vault.decrypted_secrets
  where name = 'hm_worker_secret';

  if project_url is null or worker_secret is null then
    raise exception 'Push worker Vault secrets are not configured';
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/hm-push-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || worker_secret
    ),
    body := '{}'::jsonb
  );
end;
$$;

revoke execute on function public.hm_trigger_push_worker() from public, anon, authenticated;
grant execute on function public.hm_trigger_push_worker() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    if exists (select 1 from cron.job where jobname = 'hm-push-worker') then
      perform cron.unschedule('hm-push-worker');
    end if;
    perform cron.schedule('hm-push-worker', '*/15 * * * *',
      'select public.hm_trigger_push_worker()');
  else
    raise notice 'pg_cron or pg_net is not enabled; push worker schedule was skipped.';
  end if;
end;
$$;