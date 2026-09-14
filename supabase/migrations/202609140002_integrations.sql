create function public.hm_update_installation(p_id uuid,p_hash text,p_enabled boolean,p_permission text,p_timezone text,p_token text default null) returns void language plpgsql security definer set search_path='' as $$ begin
 perform 1 from public.hm_installations where id=p_id and credential_hash=p_hash for update; if not found then raise exception 'FORBIDDEN'; end if;
 update public.hm_installations set timezone=p_timezone,last_seen_at=now() where id=p_id;
 insert into public.hm_notification_preferences(installation_id,new_quotes_enabled,permission) values(p_id,p_enabled,p_permission) on conflict(installation_id) do update set new_quotes_enabled=excluded.new_quotes_enabled,permission=excluded.permission;
 if p_token is not null then
 -- A rotated token replaces this installation's old endpoint. Tokens never leave server APIs.
 delete from public.hm_push_endpoints where token=p_token and installation_id<>p_id;
 insert into public.hm_push_endpoints(installation_id,token) values(p_id,p_token) on conflict(installation_id) do update set token=excluded.token,updated_at=now(); end if;
 end; $$;
create function public.hm_attach_quote_image(p_id uuid,p_path text,p_version integer,p_admin uuid) returns integer language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.hm_user_roles where user_id=p_admin and role='admin') then raise exception 'FORBIDDEN'; end if;
 update public.hm_quotes set image_path=p_path,version=version+1,updated_at=now() where id=p_id and version=p_version; if not found then raise exception 'VERSION_CONFLICT'; end if;
 update public.hm_daily_quotes set revision=revision+1,updated_at=now() where quote_id=p_id;
 insert into public.hm_moderation_events(quote_id,admin_id,action) values(p_id,p_admin,'image');return p_version+1;end; $$;
create function public.hm_claim_notification_events() returns setof public.hm_notification_outbox language sql security definer set search_path='' as $$ update public.hm_notification_outbox set status='processing',attempts=attempts+1,next_attempt_at=now()+interval '5 minutes' where event_id in(select event_id from public.hm_notification_outbox where status in ('pending','processing') and next_attempt_at<=now() and attempts<10 order by next_attempt_at for update skip locked limit 10) returning *; $$;
revoke execute on function public.hm_update_installation(uuid,text,boolean,text,text,text),public.hm_attach_quote_image(uuid,text,integer,uuid),public.hm_claim_notification_events() from public,anon,authenticated;
grant execute on function public.hm_update_installation(uuid,text,boolean,text,text,text),public.hm_attach_quote_image(uuid,text,integer,uuid),public.hm_claim_notification_events() to service_role;
-- Private objects: pending images are not accessible to anonymous clients.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('hm-quote-media','hm-quote-media',false,10485760,array['image/webp']);
create policy hm_approved_media on storage.objects for select to anon,authenticated using(bucket_id='hm-quote-media' and exists(select 1 from public.hm_quotes q where q.image_path=name and q.status='approved'));
-- Use a public-only RPC to authorize short-lived URLs on the media proxy. No bucket write grants.
create function public.hm_get_media_path(p_path text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.hm_quotes where image_path=p_path and status='approved'); $$;
grant execute on function public.hm_get_media_path(text) to anon,authenticated,service_role;
