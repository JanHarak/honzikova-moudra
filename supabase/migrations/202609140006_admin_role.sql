-- Administration is controlled by the database role assignment.
create or replace function public.hm_is_admin() returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from public.hm_user_roles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.hm_attach_quote_image(
  p_id uuid,
  p_path text,
  p_version integer,
  p_admin uuid
) returns integer
language plpgsql security definer set search_path=''
as $$
begin
  if not exists (
    select 1
    from public.hm_user_roles
    where user_id = p_admin
      and role = 'admin'
  ) then
    raise exception 'FORBIDDEN';
  end if;
  update public.hm_quotes
    set image_path = p_path, version = version + 1, updated_at = now()
    where id = p_id and version = p_version;
  if not found then
    raise exception 'VERSION_CONFLICT';
  end if;
  update public.hm_daily_quotes
    set revision = revision + 1, updated_at = now()
    where quote_id = p_id;
  insert into public.hm_moderation_events(quote_id, admin_id, action)
    values (p_id, p_admin, 'image');
  return p_version + 1;
end;
$$;

grant execute on function public.hm_is_admin() to anon, authenticated, service_role;
grant execute on function public.hm_attach_quote_image(uuid, text, integer, uuid) to service_role;
