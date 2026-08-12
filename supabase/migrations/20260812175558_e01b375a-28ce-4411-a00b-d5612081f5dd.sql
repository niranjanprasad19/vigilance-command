
create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

create or replace function public.can_act(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and role in ('operator','supervisor','commander')
  )
$$;

revoke all on function public.handle_new_user() from authenticated, anon;
revoke all on function public.highest_role(uuid) from authenticated, anon;
revoke all on function public.is_staff(uuid) from authenticated, anon;
revoke all on function public.can_act(uuid) from authenticated, anon;

-- decisions
drop policy if exists "staff read decisions" on public.decisions;
create policy "staff read decisions" on public.decisions
  for select to authenticated using (public.is_staff(auth.uid()));
create policy "operators create decisions" on public.decisions
  for insert to authenticated with check (public.can_act(auth.uid()) and created_by = auth.uid());
create policy "supervisors update decisions" on public.decisions
  for update to authenticated
  using (public.has_role(auth.uid(),'supervisor') or public.has_role(auth.uid(),'commander'))
  with check (public.has_role(auth.uid(),'supervisor') or public.has_role(auth.uid(),'commander'));

-- decision_approvals
drop policy if exists "staff read approvals" on public.decision_approvals;
create policy "staff read approvals" on public.decision_approvals
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'commander') or public.has_role(auth.uid(),'auditor'));
create policy "own approval insert" on public.decision_approvals
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_act(auth.uid()));
create policy "own approval update" on public.decision_approvals
  for update to authenticated
  using (user_id = auth.uid() and public.can_act(auth.uid()))
  with check (user_id = auth.uid() and public.can_act(auth.uid()));

-- tasking_orders
drop policy if exists "staff read tasking" on public.tasking_orders;
create policy "staff read tasking" on public.tasking_orders
  for select to authenticated using (public.is_staff(auth.uid()));
create policy "operators issue tasking" on public.tasking_orders
  for insert to authenticated
  with check (public.can_act(auth.uid()) and issued_by = auth.uid());
create policy "commanders update tasking" on public.tasking_orders
  for update to authenticated
  using (public.has_role(auth.uid(),'commander') or public.has_role(auth.uid(),'supervisor'))
  with check (public.has_role(auth.uid(),'commander') or public.has_role(auth.uid(),'supervisor'));

-- roe_policies
drop policy if exists "all staff read roe" on public.roe_policies;
create policy "staff read roe" on public.roe_policies
  for select to authenticated using (public.is_staff(auth.uid()));

-- profiles
drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "own or leadership profile read" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'supervisor') or public.has_role(auth.uid(),'commander'));
