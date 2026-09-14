-- Role catalog for controlled role assignment and testing.
create table public.hm_roles(
  role text primary key,
  label text not null
);

insert into public.hm_roles(role, label)
values
  ('user', 'Běžný uživatel'),
  ('admin', 'Administrátor')
on conflict (role) do update set label = excluded.label;

alter table public.hm_user_roles
  drop constraint if exists hm_user_roles_role_check;

alter table public.hm_user_roles
  add constraint hm_user_roles_role_fkey
  foreign key (role) references public.hm_roles(role);

alter table public.hm_roles enable row level security;
revoke all on public.hm_roles from anon, authenticated;
revoke all on public.hm_user_roles from anon, authenticated;

create policy own_role_catalog on public.hm_roles
  for select to authenticated
  using (public.hm_is_admin());

create or replace function public.hm_set_user_role(
  p_user_id uuid,
  p_role text
) returns void
language plpgsql security definer set search_path=''
as $$
begin
  if not public.hm_is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (select 1 from public.hm_roles where role = p_role) then
    raise exception 'INVALID_ROLE';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'USER_NOT_FOUND';
  end if;

  insert into public.hm_user_roles(user_id, role)
    values (p_user_id, p_role)
  on conflict (user_id) do update set role = excluded.role;
end;
$$;

revoke execute on function public.hm_set_user_role(uuid, text) from public, anon, authenticated;
grant execute on function public.hm_set_user_role(uuid, text) to authenticated;
grant all on table public.hm_roles, public.hm_user_roles to service_role;
grant execute on function public.hm_set_user_role(uuid, text) to service_role;
