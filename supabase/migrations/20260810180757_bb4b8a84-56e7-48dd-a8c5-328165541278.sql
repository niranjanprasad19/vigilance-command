revoke execute on function public.append_audit(text, jsonb, public.ops_mode, public.classification) from public, anon;
revoke execute on function public.verify_audit_chain() from public, anon;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.highest_role(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.append_audit(text, jsonb, public.ops_mode, public.classification) to authenticated;
grant execute on function public.verify_audit_chain() to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.highest_role(uuid) to authenticated;