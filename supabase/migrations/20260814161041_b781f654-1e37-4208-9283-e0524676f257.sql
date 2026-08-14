-- =================================================================
-- Workstream 2: signed, sealed audit (Merkle roots + idempotency)
-- =================================================================

alter table public.audit_entries add column if not exists client_request_id text;
create unique index if not exists audit_entries_client_request_id_uidx
  on public.audit_entries (client_request_id) where client_request_id is not null;

-- append_audit gains an optional idempotency key. Signature changes, so drop+recreate.
drop function if exists public.append_audit(text, jsonb, public.ops_mode, public.classification);

create or replace function public.append_audit(
  _kind text,
  _payload jsonb default '{}'::jsonb,
  _mode public.ops_mode default 'TRAINING',
  _classification public.classification default 'RESTRICTED',
  _idempotency_key text default null
)
returns table (seq bigint, ts timestamptz, hash text)
language plpgsql
security definer
set search_path to public, extensions
as $$
declare
  v_prev text;
  v_seq bigint;
  v_ts timestamptz := now();
  v_hash text;
  v_role public.app_role := public.highest_role(auth.uid());
  v_body text;
  v_existing record;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  -- idempotency: a replayed client request id returns the originally-sealed row
  if _idempotency_key is not null then
    select seq, ts, hash into v_existing
      from public.audit_entries where client_request_id = _idempotency_key limit 1;
    if found then
      return query select v_existing.seq, v_existing.ts, v_existing.hash;
      return;
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtext('vigilance.audit'));
  select a.hash into v_prev from public.audit_entries a order by a.seq desc limit 1;
  v_prev := coalesce(v_prev, repeat('0', 64));
  v_body := coalesce(_kind,'') || '|' || coalesce(auth.uid()::text,'') || '|' || coalesce(v_role::text,'')
         || '|' || _mode::text || '|' || v_ts::text || '|' || _payload::text || '|' || v_prev;
  v_hash := encode(extensions.digest(v_body, 'sha256'), 'hex');
  insert into public.audit_entries (ts, kind, actor_id, actor_role, mode, classification, payload, prev_hash, hash, client_request_id)
  values (v_ts, _kind, auth.uid(), v_role, _mode, _classification, _payload, v_prev, v_hash, _idempotency_key)
  returning audit_entries.seq into v_seq;
  return query select v_seq, v_ts, v_hash;
end;
$$;

revoke all on function public.append_audit(text, jsonb, public.ops_mode, public.classification, text) from public, anon;
grant execute on function public.append_audit(text, jsonb, public.ops_mode, public.classification, text) to authenticated;

-- sealed Merkle roots table (append-only via privileged server routine)
create table if not exists public.audit_roots (
  id uuid primary key default gen_random_uuid(),
  window_start_seq bigint not null,
  window_end_seq bigint not null,
  entry_count int not null,
  root_hash text not null,
  prev_root_hash text,
  signed_at timestamptz not null default now(),
  signature text not null,
  key_id text not null
);
grant select on public.audit_roots to authenticated;
grant all on public.audit_roots to service_role;
alter table public.audit_roots enable row level security;
create policy "auditors and commanders read roots" on public.audit_roots
  for select to authenticated using (
    public.has_role(auth.uid(),'auditor') or public.has_role(auth.uid(),'commander')
  );

-- =================================================================
-- Workstream 3: sensor provenance / data lineage
-- =================================================================

alter table public.decisions add column if not exists source_sensor text;
alter table public.decisions add column if not exists sensor_band text;
alter table public.decisions add column if not exists fusion_step text;
alter table public.decisions add column if not exists observed_at timestamptz;

alter table public.tasking_orders add column if not exists source_sensor text;
alter table public.tasking_orders add column if not exists sensor_band text;

-- =================================================================
-- Workstream 4: tasking idempotency (store-and-forward)
-- =================================================================

alter table public.tasking_orders add column if not exists client_request_id text;
create unique index if not exists tasking_orders_client_request_id_uidx
  on public.tasking_orders (client_request_id) where client_request_id is not null;