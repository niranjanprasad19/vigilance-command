
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

create or replace function public.can_act(_user_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('operator','supervisor','commander')
  )
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.highest_role(uuid) from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.append_audit(text, jsonb, public.ops_mode, public.classification) from public, anon;
revoke all on function public.verify_audit_chain() from public, anon;
revoke all on function public.is_staff(uuid) from public, anon;
revoke all on function public.can_act(uuid) from public, anon;

grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.append_audit(text, jsonb, public.ops_mode, public.classification) to authenticated;
grant execute on function public.verify_audit_chain() to authenticated;
grant execute on function public.is_staff(uuid) to authenticated;
grant execute on function public.can_act(uuid) to authenticated;
