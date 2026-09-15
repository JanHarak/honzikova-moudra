-- Moving an already delivered reminder to a new future time schedules it again
-- for this installation only. Saving the same time must remain idempotent.
create or replace function public.hm_set_daily_notification(
  p_id uuid,
  p_hash text,
  p_enabled boolean,
  p_time text default '08:00'
) returns void language plpgsql security definer set search_path='' as $$
declare
  installation_timezone text;
  previous_time time;
begin
  select timezone into installation_timezone
  from public.hm_installations
  where id = p_id and credential_hash = p_hash
  for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  if p_time is null or p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'INVALID_TIME';
  end if;

  select daily_time into previous_time
  from public.hm_notification_preferences where installation_id = p_id;

  insert into public.hm_notification_preferences(installation_id,daily_enabled,daily_time,permission)
    values(p_id,p_enabled,p_time::time,'granted')
    on conflict(installation_id) do update
      set daily_enabled=excluded.daily_enabled,daily_time=excluded.daily_time;

  if p_enabled and previous_time is distinct from p_time::time
     and p_time::time > (now() at time zone coalesce(installation_timezone,'Europe/Prague'))::time then
    update public.hm_notification_deliveries d
    set status = 'pending', attempts = 0, provider_message_id = null
    from public.hm_push_endpoints e, public.hm_notification_outbox o
    where d.endpoint_id = e.id and e.installation_id = p_id
      and d.event_id = o.event_id and o.notification_type = 'daily'
      and o.daily_date = (now() at time zone 'Europe/Prague')::date
      and d.status = 'sent';

    if found then
      update public.hm_notification_outbox
      set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null
      where notification_type = 'daily'
        and daily_date = (now() at time zone 'Europe/Prague')::date
        and status in ('sent','failed');
    end if;
  end if;
end;
$$;

revoke execute on function public.hm_set_daily_notification(uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.hm_set_daily_notification(uuid,text,boolean,text) to service_role;
