-- All mutations are constrained RPCs; no client receives table write privileges.
create extension if not exists pgcrypto;
create table public.hm_user_roles(user_id uuid primary key references auth.users on delete cascade, role text not null check(role='admin'));
create table public.hm_quotes(id uuid primary key default gen_random_uuid(), text text not null check(char_length(btrim(text)) between 1 and 500), status text not null default 'pending' check(status in ('pending','approved','rejected','hidden')), submitted_by uuid references auth.users on delete set null, request_id uuid, image_path text, image_alt text not null default '', first_published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1, legacy_id text unique, unique(submitted_by,request_id));
create index hm_quotes_status_id on public.hm_quotes(status,id);
create index hm_quotes_author_created on public.hm_quotes(submitted_by,created_at);
create table public.hm_moderation_events(id uuid primary key default gen_random_uuid(),quote_id uuid references public.hm_quotes on delete set null,admin_id uuid references auth.users on delete set null,action text not null,from_status text,to_status text,note text,created_at timestamptz not null default now());
create table public.hm_daily_quotes(date date primary key,quote_id uuid references public.hm_quotes on delete cascade,selection_source text not null check(selection_source in ('manual','automatic')),revision integer not null default 1,updated_at timestamptz not null default now());
create table public.hm_publication_batches(id uuid primary key default gen_random_uuid(),created_by uuid references auth.users on delete set null,created_at timestamptz not null default now());
create table public.hm_publication_items(batch_id uuid references public.hm_publication_batches on delete cascade,quote_id uuid unique references public.hm_quotes on delete cascade,primary key(batch_id,quote_id));
create table public.hm_notification_outbox(event_id uuid primary key default gen_random_uuid(),batch_id uuid references public.hm_publication_batches on delete cascade,status text not null default 'pending',attempts integer not null default 0,next_attempt_at timestamptz not null default now(),last_error text);
create table public.hm_installations(id uuid primary key default gen_random_uuid(),credential_hash text not null,platform text not null default 'ios',timezone text not null default 'Europe/Prague',last_seen_at timestamptz not null default now());
create table public.hm_notification_preferences(installation_id uuid primary key references public.hm_installations on delete cascade,new_quotes_enabled boolean not null default false,permission text not null default 'prompt');
create table public.hm_push_endpoints(id uuid primary key default gen_random_uuid(),installation_id uuid unique references public.hm_installations on delete cascade,provider text not null default 'apns',token text not null unique,updated_at timestamptz not null default now());
create table public.hm_notification_deliveries(event_id uuid references public.hm_notification_outbox on delete cascade,endpoint_id uuid references public.hm_push_endpoints on delete cascade,status text not null default 'pending',attempts integer not null default 0,provider_message_id text,primary key(event_id,endpoint_id));
create table public.hm_app_settings(key text primary key,value integer not null);
insert into public.hm_app_settings values ('submissions_per_hour',5);

do $$ declare t text; begin foreach t in array array['hm_user_roles','hm_quotes','hm_moderation_events','hm_daily_quotes','hm_publication_batches','hm_publication_items','hm_notification_outbox','hm_installations','hm_notification_preferences','hm_push_endpoints','hm_notification_deliveries','hm_app_settings'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon, authenticated',t); end loop; end $$;
create function public.hm_is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.hm_user_roles where user_id=auth.uid() and role='admin'); $$;
create policy own_role on public.hm_user_roles for select to authenticated using(user_id=auth.uid());
create policy visible_quotes on public.hm_quotes for select using(status='approved' or submitted_by=auth.uid() or public.hm_is_admin());
-- No insert/update/delete policies: direct attempts fail even if grants are later widened accidentally.
create policy admin_audit on public.hm_moderation_events for select to authenticated using(public.hm_is_admin());
create policy visible_plan on public.hm_daily_quotes for select using(date between (now() at time zone 'Europe/Prague')::date and (now() at time zone 'Europe/Prague')::date+6 and exists(select 1 from public.hm_quotes q where q.id=quote_id and q.status='approved'));

create function public.hm_list_published_quotes(p_cursor uuid default null,p_limit integer default 100) returns table(id uuid,text text,image_path text,image_alt text,version integer) language sql stable security definer set search_path='' as $$ select q.id,q.text,q.image_path,q.image_alt,q.version from public.hm_quotes q where q.status='approved' and (p_cursor is null or q.id>p_cursor) order by q.id limit least(greatest(p_limit,1),100); $$;
create function public.hm_get_published_quote(p_id uuid) returns table(id uuid,text text,image_path text,image_alt text,version integer) language sql stable security definer set search_path='' as $$ select q.id,q.text,q.image_path,q.image_alt,q.version from public.hm_quotes q where q.id=p_id and q.status='approved'; $$;
create function public.hm_list_own_submissions() returns table(id uuid,text text,status text,created_at timestamptz,image_path text,image_alt text,version integer) language sql stable security definer set search_path='' as $$ select q.id,q.text,q.status,q.created_at,q.image_path,q.image_alt,q.version from public.hm_quotes q where q.submitted_by=auth.uid() order by q.created_at desc; $$;
create function public.hm_submit_quote(p_text text,p_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$ declare uid uuid:=auth.uid(); existing public.hm_quotes; new_id uuid; lim integer; begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'EMAIL_REQUIRED'; end if;
 if p_text is null or char_length(btrim(p_text)) not between 1 and 500 or p_request_id is null then raise exception 'INVALID_TEXT'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into existing from public.hm_quotes where submitted_by=uid and request_id=p_request_id;
 if found then if existing.text<>btrim(p_text) then raise exception 'REQUEST_CONFLICT'; end if; return existing.id; end if;
 select value into lim from public.hm_app_settings where key='submissions_per_hour';
 if (select count(*) from public.hm_quotes where submitted_by=uid and created_at>now()-interval '1 hour')>=lim then raise exception 'RATE_LIMIT'; end if;
 insert into public.hm_quotes(text,submitted_by,request_id) values(btrim(p_text),uid,p_request_id) returning id into new_id; return new_id; end; $$;

create function public.hm_fill_daily_plan() returns void language plpgsql security definer set search_path='' as $$ declare d date; picked uuid; begin
 perform pg_advisory_xact_lock(719024);
 for d in select generate_series((now() at time zone 'Europe/Prague')::date, (now() at time zone 'Europe/Prague')::date+6, interval '1 day')::date loop
 if exists(select 1 from public.hm_daily_quotes p join public.hm_quotes q on q.id=p.quote_id where p.date=d and q.status='approved') then continue; end if;
 select q.id into picked from public.hm_quotes q left join public.hm_daily_quotes p on p.quote_id=q.id and p.date<d where q.status='approved' group by q.id order by max(p.date) asc nulls first,q.id limit 1;
 if picked is not null then insert into public.hm_daily_quotes(date,quote_id,selection_source) values(d,picked,'automatic') on conflict(date) do update set quote_id=excluded.quote_id,selection_source='automatic',revision=public.hm_daily_quotes.revision+1,updated_at=now();
 else update public.hm_daily_quotes set quote_id=null,revision=revision+1,updated_at=now() where date=d and quote_id is not null; end if;
 end loop; end; $$;
create function public.hm_get_daily_plan(p_from date,p_days integer default 7) returns table(date date,quote_id uuid,text text,image_path text,image_alt text,revision integer,valid_from timestamptz,valid_until timestamptz) language sql stable security definer set search_path='' as $$ select d.date,q.id,q.text,q.image_path,q.image_alt,d.revision,d.date::timestamp at time zone 'Europe/Prague',(d.date+1)::timestamp at time zone 'Europe/Prague' from public.hm_daily_quotes d join public.hm_quotes q on q.id=d.quote_id where q.status='approved' and d.date>=greatest(p_from,(now() at time zone 'Europe/Prague')::date) and d.date<least(p_from+least(greatest(p_days,1),7),(now() at time zone 'Europe/Prague')::date+7) order by d.date; $$;
create function public.hm_set_daily_quote(p_date date,p_quote_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.hm_is_admin() then raise exception 'FORBIDDEN'; end if; perform pg_advisory_xact_lock(719024);
 if p_date<(now() at time zone 'Europe/Prague')::date then raise exception 'INVALID_DATE'; end if;
 perform 1 from public.hm_quotes where id=p_quote_id and status='approved' for update; if not found then raise exception 'NOT_APPROVED'; end if;
 insert into public.hm_daily_quotes(date,quote_id,selection_source) values(p_date,p_quote_id,'manual') on conflict(date) do update set quote_id=excluded.quote_id,selection_source='manual',revision=public.hm_daily_quotes.revision+1,updated_at=now();
 insert into public.hm_moderation_events(quote_id,admin_id,action,note) values(p_quote_id,auth.uid(),'schedule',p_date::text); end; $$;
create function public.hm_admin_list_quotes(p_status text) returns table(id uuid,text text,status text,created_at timestamptz,image_path text,image_alt text,version integer,duplicate boolean) language plpgsql stable security definer set search_path='' as $$ begin if not public.hm_is_admin() then raise exception 'FORBIDDEN'; end if; return query select q.id,q.text,q.status,q.created_at,q.image_path,q.image_alt,q.version,exists(select 1 from public.hm_quotes other where other.id<>q.id and lower(btrim(other.text))=lower(btrim(q.text))) from public.hm_quotes q where q.status=p_status order by q.created_at; end; $$;
create function public.hm_moderate_quotes(p_ids uuid[],p_action text,p_versions integer[]) returns uuid language plpgsql security definer set search_path='' as $$ declare q public.hm_quotes; next_status text; batch uuid; i integer; begin
 if not public.hm_is_admin() then raise exception 'FORBIDDEN'; end if;
 if cardinality(p_ids) is null or cardinality(p_ids) not between 1 and 100 or cardinality(p_ids)<>cardinality(p_versions) or (select count(distinct x) from unnest(p_ids) x)<>cardinality(p_ids) then raise exception 'INVALID_INPUT'; end if;
 next_status:=case p_action when 'approve' then 'approved' when 'reject' then 'rejected' when 'hide' then 'hidden' else null end; if next_status is null then raise exception 'INVALID_ACTION'; end if;
 perform pg_advisory_xact_lock(719024);
 perform 1 from public.hm_quotes where id=any(p_ids) order by id for update;
 for i in 1..cardinality(p_ids) loop
 select * into q from public.hm_quotes where id=p_ids[i]; if not found or q.version<>p_versions[i] then raise exception 'VERSION_CONFLICT'; end if;
 if next_status=q.status then continue; end if;
 if (next_status='rejected' and q.status<>'pending') or (next_status='hidden' and q.status<>'approved') then raise exception 'INVALID_TRANSITION'; end if;
 if next_status='approved' and q.image_path is not null and btrim(q.image_alt)='' then raise exception 'IMAGE_ALT_REQUIRED'; end if;
 if next_status='approved' and q.first_published_at is null then
 if batch is null then insert into public.hm_publication_batches(created_by) values(auth.uid()) returning id into batch; end if;
 insert into public.hm_publication_items(batch_id,quote_id) values(batch,q.id);
 end if;
 update public.hm_quotes set status=next_status,version=version+1,updated_at=now(),first_published_at=case when next_status='approved' then coalesce(first_published_at,now()) else first_published_at end where id=q.id;
 insert into public.hm_moderation_events(quote_id,admin_id,action,from_status,to_status) values(q.id,auth.uid(),p_action,q.status,next_status);
 if next_status<>'approved' then update public.hm_daily_quotes set quote_id=null,selection_source='automatic',revision=revision+1,updated_at=now() where quote_id=q.id and date>=(now() at time zone 'Europe/Prague')::date; end if;
 end loop;
 if batch is not null then insert into public.hm_notification_outbox(batch_id) values(batch); end if;
 perform public.hm_fill_daily_plan(); return batch; end; $$;
create function public.hm_edit_quote(p_id uuid,p_text text,p_alt text,p_version integer) returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.hm_is_admin() then raise exception 'FORBIDDEN'; end if;
 if p_text is null or char_length(btrim(p_text)) not between 1 and 500 or length(p_alt)>1000 then raise exception 'INVALID_TEXT'; end if;
 update public.hm_quotes set text=btrim(p_text),image_alt=coalesce(p_alt,''),version=version+1,updated_at=now() where id=p_id and version=p_version; if not found then raise exception 'VERSION_CONFLICT'; end if;
 update public.hm_daily_quotes set revision=revision+1,updated_at=now() where quote_id=p_id;
 insert into public.hm_moderation_events(quote_id,admin_id,action) values(p_id,auth.uid(),'edit'); end; $$;
create function public.hm_get_publication_batch(p_id uuid) returns table(id uuid,text text,image_path text,image_alt text,version integer) language sql stable security definer set search_path='' as $$ select q.id,q.text,q.image_path,q.image_alt,q.version from public.hm_quotes q join public.hm_publication_items p on p.quote_id=q.id where p.batch_id=p_id and q.status='approved' order by q.id; $$;

-- Explicit allowlist, scoped ONLY to hm_ objects: this project shares the public schema
-- with another application, so blanket "all functions/tables in schema public" statements
-- (which would touch the other project's objects) are intentionally avoided.
-- Postgres grants EXECUTE to PUBLIC by default; revoke it on every hm_ function, then grant explicitly.
revoke execute on function public.hm_is_admin(),public.hm_list_published_quotes(uuid,integer),public.hm_get_published_quote(uuid),public.hm_list_own_submissions(),public.hm_submit_quote(text,uuid),public.hm_fill_daily_plan(),public.hm_get_daily_plan(date,integer),public.hm_set_daily_quote(date,uuid),public.hm_admin_list_quotes(text),public.hm_moderate_quotes(uuid[],text,integer[]),public.hm_edit_quote(uuid,text,text,integer),public.hm_get_publication_batch(uuid) from public,anon,authenticated;
grant execute on function public.hm_is_admin(),public.hm_list_published_quotes(uuid,integer),public.hm_get_published_quote(uuid),public.hm_get_daily_plan(date,integer),public.hm_get_publication_batch(uuid) to anon,authenticated;
grant execute on function public.hm_submit_quote(text,uuid),public.hm_list_own_submissions(),public.hm_admin_list_quotes(text),public.hm_moderate_quotes(uuid[],text,integer[]),public.hm_edit_quote(uuid,text,text,integer),public.hm_set_daily_quote(date,uuid) to authenticated;
-- hm_fill_daily_plan is intentionally granted to no client role: only service_role (worker/cron) may run it.
grant all on table public.hm_user_roles,public.hm_quotes,public.hm_moderation_events,public.hm_daily_quotes,public.hm_publication_batches,public.hm_publication_items,public.hm_notification_outbox,public.hm_installations,public.hm_notification_preferences,public.hm_push_endpoints,public.hm_notification_deliveries,public.hm_app_settings to service_role;
grant execute on function public.hm_is_admin(),public.hm_list_published_quotes(uuid,integer),public.hm_get_published_quote(uuid),public.hm_list_own_submissions(),public.hm_submit_quote(text,uuid),public.hm_fill_daily_plan(),public.hm_get_daily_plan(date,integer),public.hm_set_daily_quote(date,uuid),public.hm_admin_list_quotes(text),public.hm_moderate_quotes(uuid[],text,integer[]),public.hm_edit_quote(uuid,text,text,integer),public.hm_get_publication_batch(uuid) to service_role;
