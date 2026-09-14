-- Bootstrap the existing owner account into the database-controlled admin role.
insert into public.hm_user_roles(user_id, role)
select id, 'admin'
from auth.users
where lower(email) = 'jan.harak@gmail.com'
on conflict (user_id) do update set role = excluded.role;

-- Every newly registered account receives the least-privileged role.
create or replace function public.hm_assign_default_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.hm_user_roles(user_id, role)
    values (new.id, 'user')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.hm_assign_default_role() from public, anon, authenticated;
grant execute on function public.hm_assign_default_role() to service_role;

drop trigger if exists hm_assign_default_role on auth.users;
create trigger hm_assign_default_role
after insert on auth.users
for each row execute function public.hm_assign_default_role();

-- Keep direct client writes blocked. Role changes must go through hm_set_user_role.
revoke insert, update, delete on public.hm_user_roles from anon, authenticated;
revoke insert, update, delete on public.hm_roles from anon, authenticated;
