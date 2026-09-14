-- Web Push subscriptions share the installation lifecycle with native APNs devices.
alter table public.hm_notification_preferences
  add column if not exists daily_enabled boolean not null default false;

alter table public.hm_push_endpoints
  add column if not exists provider text not null default 'apns';

alter table public.hm_notification_outbox
  add column if not exists notification_type text not null default 'new_quotes',
  add column if not exists daily_date date;

alter table public.hm_notification_outbox
  drop constraint if exists hm_notification_outbox_batch_id_fkey;
alter table public.hm_notification_outbox
  add constraint hm_notification_outbox_batch_id_fkey
  foreign key (batch_id) references public.hm_publication_batches on delete cascade;

create unique index if not exists hm_daily_notification_once
  on public.hm_notification_outbox(notification_type, daily_date)
  where notification_type = 'daily' and daily_date is not null;

create or replace function public.hm_update_installation(
  p_id uuid,
  p_hash text,
  p_enabled boolean,
  p_permission text,
  p_timezone text,
  p_token text default null,
  p_provider text default 'apns'
) returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.hm_installations where id=p_id and credential_hash=p_hash for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  if p_provider not in ('apns', 'webpush') then raise exception 'INVALID_PROVIDER'; end if;
  update public.hm_installations set platform=case when p_provider='webpush' then 'web' else platform end, timezone=p_timezone,last_seen_at=now() where id=p_id;
  insert into public.hm_notification_preferences(installation_id,new_quotes_enabled,permission)
    values(p_id,p_enabled,p_permission)
    on conflict(installation_id) do update set new_quotes_enabled=excluded.new_quotes_enabled,permission=excluded.permission;
  if p_token is not null then
    delete from public.hm_push_endpoints where token=p_token and installation_id<>p_id;
    insert into public.hm_push_endpoints(installation_id,token,provider)
      values(p_id,p_token,p_provider)
      on conflict(installation_id) do update set token=excluded.token,provider=excluded.provider,updated_at=now();
  end if;
end; $$;

create or replace function public.hm_set_daily_notification(p_id uuid,p_hash text,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.hm_installations where id=p_id and credential_hash=p_hash) then raise exception 'FORBIDDEN'; end if;
  insert into public.hm_notification_preferences(installation_id,daily_enabled,permission)
    values(p_id,p_enabled,'granted')
    on conflict(installation_id) do update set daily_enabled=excluded.daily_enabled;
end; $$;

create or replace function public.hm_get_random_notification_quote() returns table(id uuid,text text) language sql stable security definer set search_path='' as $$
  select q.id,q.text from public.hm_quotes q where q.status='approved' order by random() limit 1;
$$;

create or replace function public.hm_enqueue_daily_notification() returns void language plpgsql security definer set search_path='' as $$
declare today date := (now() at time zone 'Europe/Prague')::date;
begin
  insert into public.hm_notification_outbox(notification_type,daily_date)
    values('daily',today) on conflict do nothing;
end; $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'hm-daily-notification') then
      perform cron.unschedule('hm-daily-notification');
    end if;
    perform cron.schedule('hm-daily-notification', '*/15 * * * *', 'select public.hm_enqueue_daily_notification()');
  end if;
end $$;

revoke execute on function public.hm_update_installation(uuid,text,boolean,text,text,text,text),public.hm_set_daily_notification(uuid,text,boolean),public.hm_get_random_notification_quote(),public.hm_enqueue_daily_notification() from public,anon,authenticated;
grant execute on function public.hm_update_installation(uuid,text,boolean,text,text,text,text),public.hm_set_daily_notification(uuid,text,boolean),public.hm_get_random_notification_quote(),public.hm_enqueue_daily_notification() to service_role;