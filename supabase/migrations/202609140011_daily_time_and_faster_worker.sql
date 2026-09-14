alter table public.hm_notification_preferences
  add column if not exists daily_time time not null default '08:00';

drop function if exists public.hm_set_daily_notification(uuid, text, boolean);
create function public.hm_set_daily_notification(
  p_id uuid,
  p_hash text,
  p_enabled boolean,
  p_time text default '08:00'
) returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.hm_installations where id=p_id and credential_hash=p_hash) then raise exception 'FORBIDDEN'; end if;
  if p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'INVALID_TIME'; end if;
  insert into public.hm_notification_preferences(installation_id,daily_enabled,daily_time,permission)
    values(p_id,p_enabled,p_time::time,'granted')
    on conflict(installation_id) do update set daily_enabled=excluded.daily_enabled,daily_time=excluded.daily_time;
end; $$;

revoke execute on function public.hm_set_daily_notification(uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.hm_set_daily_notification(uuid,text,boolean,text) to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'hm-push-worker') then
    perform cron.unschedule('hm-push-worker');
  end if;
  perform cron.schedule('hm-push-worker', '* * * * *',
    'select public.hm_trigger_push_worker()');
end;
$$;