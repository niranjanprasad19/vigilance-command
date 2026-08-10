-- ============ enums ============
create type public.app_role as enum ('operator','supervisor','commander','auditor');
create type public.ops_mode as enum ('TRAINING','LIVE');
create type public.classification as enum ('UNCLASSIFIED','RESTRICTED','CONFIDENTIAL','SECRET');

create extension if not exists pgcrypto with schema extensions;

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  callsign text not null,
  unit text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by authenticated" on public.profiles
  for select to authenticated using (true);
create policy "own profile update" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ============ user_roles ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.highest_role(_user_id uuid)
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles where user_id = _user_id
  order by case role
    when 'commander' then 4 when 'supervisor' then 3
    when 'operator' then 2 when 'auditor' then 1 end desc
  limit 1
$$;

create policy "read own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);
create policy "commanders read all roles" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(),'commander'));

-- signup trigger: profile + default role (first user becomes commander)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  insert into public.profiles (id, callsign, unit)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'callsign', split_part(new.email,'@',1)),
          new.raw_user_meta_data->>'unit');
  select count(*) into n from public.user_roles;
  insert into public.user_roles (user_id, role)
  values (new.id, case when n = 0 then 'commander'::public.app_role else 'operator'::public.app_role end);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ audit journal (append-only, hash chained) ============
create table public.audit_entries (
  seq bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  kind text not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role public.app_role,
  mode public.ops_mode not null default 'TRAINING',
  classification public.classification not null default 'RESTRICTED',
  payload jsonb not null default '{}'::jsonb,
  prev_hash text not null,
  hash text not null
);
grant select on public.audit_entries to authenticated;
grant all on public.audit_entries to service_role;
alter table public.audit_entries enable row level security;
-- NOTE: no insert/update/delete policies exist. Writes happen only through
-- public.append_audit (security definer). The journal is append-only by construction.
create policy "auditors and commanders read journal" on public.audit_entries
  for select to authenticated using (
    public.has_role(auth.uid(),'auditor') or public.has_role(auth.uid(),'commander')
  );

create or replace function public.append_audit(
  _kind text,
  _payload jsonb default '{}'::jsonb,
  _mode public.ops_mode default 'TRAINING',
  _classification public.classification default 'RESTRICTED'
)
returns table (seq bigint, ts timestamptz, hash text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_prev text;
  v_seq bigint;
  v_ts timestamptz := now();
  v_hash text;
  v_role public.app_role := public.highest_role(auth.uid());
  v_body text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform pg_advisory_xact_lock(hashtext('vigilance.audit'));
  select a.hash into v_prev from public.audit_entries a order by a.seq desc limit 1;
  v_prev := coalesce(v_prev, repeat('0', 64));
  v_body := coalesce(_kind,'') || '|' || coalesce(auth.uid()::text,'') || '|' || coalesce(v_role::text,'')
         || '|' || _mode::text || '|' || v_ts::text || '|' || _payload::text || '|' || v_prev;
  v_hash := encode(extensions.digest(v_body, 'sha256'), 'hex');
  insert into public.audit_entries (ts, kind, actor_id, actor_role, mode, classification, payload, prev_hash, hash)
  values (v_ts, _kind, auth.uid(), v_role, _mode, _classification, _payload, v_prev, v_hash)
  returning audit_entries.seq into v_seq;
  return query select v_seq, v_ts, v_hash;
end;
$$;
grant execute on function public.append_audit(text, jsonb, public.ops_mode, public.classification) to authenticated;

create or replace function public.verify_audit_chain()
returns table (ok boolean, total bigint, broken_at bigint)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  r record;
  v_prev text := repeat('0', 64);
  v_expected text;
  v_total bigint := 0;
  v_broken bigint := null;
begin
  if not (public.has_role(auth.uid(),'auditor') or public.has_role(auth.uid(),'commander')) then
    raise exception 'insufficient privileges';
  end if;
  for r in select * from public.audit_entries order by seq asc loop
    v_total := v_total + 1;
    v_expected := encode(extensions.digest(
      coalesce(r.kind,'') || '|' || coalesce(r.actor_id::text,'') || '|' || coalesce(r.actor_role::text,'')
      || '|' || r.mode::text || '|' || r.ts::text || '|' || r.payload::text || '|' || v_prev, 'sha256'), 'hex');
    if v_broken is null and (r.prev_hash <> v_prev or r.hash <> v_expected) then
      v_broken := r.seq;
    end if;
    v_prev := r.hash;
  end loop;
  return query select (v_broken is null), v_total, v_broken;
end;
$$;
grant execute on function public.verify_audit_chain() to authenticated;

-- ============ ROE policy ============
create table public.roe_policies (
  id uuid primary key default gen_random_uuid(),
  version int not null,
  name text not null,
  thresholds jsonb not null,
  auto_execute_ceiling int not null default 3 check (auto_execute_ceiling between 0 and 5),
  dual_confirm_from int not null default 5 check (dual_confirm_from between 1 and 5),
  active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (version)
);
grant select on public.roe_policies to authenticated;
grant insert, update on public.roe_policies to authenticated;
grant all on public.roe_policies to service_role;
alter table public.roe_policies enable row level security;
create policy "all staff read roe" on public.roe_policies
  for select to authenticated using (true);
create policy "commanders write roe" on public.roe_policies
  for insert to authenticated with check (public.has_role(auth.uid(),'commander'));
create policy "commanders update roe" on public.roe_policies
  for update to authenticated using (public.has_role(auth.uid(),'commander'))
  with check (public.has_role(auth.uid(),'commander'));

insert into public.roe_policies (version, name, thresholds, auto_execute_ceiling, dual_confirm_from, active)
values (1, 'BASELINE ROE v1',
  '{"l2":0.25,"l3":0.45,"l4":0.65,"l5":0.85,"critical_bump":1,"low_confidence_bump":1,"low_confidence_below":0.5}'::jsonb,
  3, 5, true);

-- ============ decisions ============
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  entity_id text,
  entity_label text,
  level int not null check (level between 1 and 5),
  action text not null,
  rationale text not null,
  score numeric,
  confidence numeric,
  severity text,
  model_version text not null default 'vigilance-triage-1.0.0',
  policy_version int,
  mode public.ops_mode not null default 'TRAINING',
  classification public.classification not null default 'RESTRICTED',
  status text not null default 'PENDING',
  auto_execute boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  modified_action text
);
create index decisions_created_at_idx on public.decisions (created_at desc);
grant select on public.decisions to authenticated;
grant all on public.decisions to service_role;
alter table public.decisions enable row level security;
create policy "staff read decisions" on public.decisions
  for select to authenticated using (true);

-- ============ decision approvals (dual-key) ============
create table public.decision_approvals (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_role public.app_role not null,
  outcome text not null check (outcome in ('APPROVED','MODIFIED','REJECTED')),
  modified_action text,
  created_at timestamptz not null default now(),
  unique (decision_id, user_id)
);
grant select on public.decision_approvals to authenticated;
grant all on public.decision_approvals to service_role;
alter table public.decision_approvals enable row level security;
create policy "staff read approvals" on public.decision_approvals
  for select to authenticated using (true);

-- ============ tasking orders ============
create table public.tasking_orders (
  id uuid primary key default gen_random_uuid(),
  asset text not null,
  directive text not null,
  source text not null,
  trigger_level int,
  trigger_label text,
  decision_id uuid references public.decisions(id) on delete set null,
  mode public.ops_mode not null default 'TRAINING',
  classification public.classification not null default 'RESTRICTED',
  status text not null default 'DISPATCHED',
  issued_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index tasking_orders_created_at_idx on public.tasking_orders (created_at desc);
grant select on public.tasking_orders to authenticated;
grant all on public.tasking_orders to service_role;
alter table public.tasking_orders enable row level security;
create policy "staff read tasking" on public.tasking_orders
  for select to authenticated using (true);