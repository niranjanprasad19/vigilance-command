# Vigilance — Hardening Pass (MFA, Signed Audit, Provenance, Store-and-Forward)

## Goal

Close the four remaining gaps from the defence-readiness roadmap, inside the existing server-authoritative architecture. The browser proposes; the server decides; nothing is enforced only in the UI.

1. **Step-up MFA for lethal (L5) authority** — a second factor verified at the moment of action, not at login.
2. **Signed, sealed audit** — periodic Merkle roots signed with a server-held key, exportable as evidence.
3. **Sensor-provenance / data lineage** — every decision and tasking order records which sensor, band, fusion step and observation time produced the track.
4. **Store-and-forward resilience** — a client outbox that buffers writes when the link is down (and during the real comms-loss degraded mode), with idempotent reconciliation on reconnect.

---

## Workstream 1 — Step-up MFA for L5

**DB** (`supabase/migrations/`):
- No new table. Supabase Auth already stores TOTP factors in `auth.mfa_factors`.
- Add a server secret `AUDIT_STEPUP_KEY` (via add_secret) used to mint short-lived step-up tokens.

**Server** (`src/lib/auth.stepup.functions.ts`, new — thin wrappers):
- `enrollMfa`: wraps `supabase.auth.mfa.enroll` (TOTP) for the signed-in user; returns QR secret. Uses `requireSupabaseAuth`.
- `stepUpChallenge`: given the user's enrolled TOTP factor, calls `supabase.auth.mfa.challenge` and returns the `challengeId`.
- `stepUpVerify(challengeId, code)`: calls `supabase.auth.mfa.verify`. On success, mints a stateless step-up JWT (HS256, `AUDIT_STEPUP_KEY`, 60s exp, `{ userId, at: now }`) and returns it. On failure returns `{ ok: false }`.
- `resolveDecisionServer` (existing, in `ops.functions.ts`): when `level >= policy.dualConfirmFrom`, require `data.stepUpToken`; verify signature + expiry + `userId === context.userId` before the dual-key block proceeds. Reject with `reason: "Step-up authentication required"` otherwise.

**Client**:
- `src/lib/ops-context.tsx`: expose `mfaEnrolled` (from a `getMySession` extension that reports enrolled factors) and a `stepUp()` promise that opens the MFA modal and resolves to a step-up token.
- `src/components/dashboard/MfaGate.tsx` (new): modal collecting a 6-digit TOTP; calls `stepUpChallenge` + `stepUpVerify`; on success hands the token to the caller.
- `src/components/dashboard/ApprovalQueue.tsx`: before the first L5 APPROVE/MODIFY, require `stepUp()` → pass `stepUpToken` into `resolveDecision`. The existing "click again to confirm" second-click is removed; the gate is the MFA challenge, not a checkbox.
- Account / profile surface: an "Enroll MFA (TOTP)" affordance for commanders (and any role that can act on L5) so the flow is reachable. Roles without an enrolled factor are blocked from L5 with a clear "Enroll MFA first" message.

**Verified state**: L5 resolution 401s without a valid, unexpired, user-matched step-up token; a second person's token is still rejected (the dual-key `decision_approvals(user_id)` unique constraint still requires two distinct commanders).

---

## Workstream 2 — Signed, sealed audit (Merkle roots)

**DB** (`supabase/migrations/`):
- New table `public.audit_roots`:
  `id uuid pk`, `window_start_seq bigint`, `window_end_seq bigint`, `entry_count int`, `root_hash text not null`, `prev_root_hash text`, `signed_at timestamptz default now()`, `signature text not null`, `key_id text not null`.
- `GRANT SELECT ON public.audit_roots TO authenticated; GRANT ALL … TO service_role;` + RLS: `SELECT` for `auditor`/`commander`; no INSERT/UPDATE/DELETE policy (writes only via a security-definer routine).
- Add `client_request_id text` unique column to `audit_entries` + extend `append_audit` with an optional `_idempotency_key` param: `on conflict (client_request_id) do update set hash = audit_entries.hash` (no-op, returns existing row) so re-flushed appends never duplicate. Default null when called directly.

**Server** (`src/lib/audit.merkle.functions.ts`, new — thin wrappers):
- `signAuditRoot()`: reads the highest `window_end_seq` (or 0), fetches `audit_entries` with `seq > last_end` ordered asc, builds a binary Merkle tree of `hash` leaves (pairwise SHA-256, zero-pad odd), signs the root with HMAC-SHA256 (`AUDIT_SIGNING_KEY`, a key id `vig-1`) — Ed25519 would need a key pair; HMAC keeps it Worker-safe and deterministic. Inserts the `audit_roots` row, then appends an `AUDIT_ROOT_SIGNED` audit entry linking the window. Commander/auditor only.
- `verifyAuditRoots()`: recomputes each root from the entry range, checks the stored signature, checks `prev_root_hash` chaining of roots, returns `{ ok, sealed, brokenAtRoot }`.
- `exportAuditBundle()`: returns the entries + all `audit_roots` + signatures as one signed JSON document (commander/auditor).

**Client** (`src/components/dashboard/AuditLogPanel.tsx`):
- "Seal window" button (auditor/commander) → `signAuditRoot`; shows the latest root hash, signature, key id, and a `VERIFIED · N roots sealed` banner from `verifyAuditRoots`.
- "Export evidence" now downloads the signed bundle (roots + signatures), not just raw entries.

**Verified state**: after sealing, `verifyAuditRoots` confirms each root recomputes and each signature is valid; tampering any sealed entry breaks verification at that root.

---

## Workstream 3 — Sensor-provenance / data lineage

**DB** (`supabase/migrations/`):
- Add to `decisions`: `source_sensor text`, `sensor_band text`, `fusion_step text`, `observed_at timestamptz`.
- Add to `tasking_orders`: `source_sensor text`, `sensor_band text`.
- (No new table — lineage travels on the rows it explains. A standalone `sensor_observations` stream is out of scope for this pass; the simulator feeds it instead.)

**Telemetry / classifier** (`src/lib/telemetry.ts`, `src/lib/threat-levels.ts`):
- Add `sensorId?`, `band?`, `sector?`, `fusionStep?` to `ThreatEvent`. The simulator attaches the originating feed (the feed whose sector contains the entity, or `RF` for signal entities) and a `fusionStep` label (`"L1-DETECT"` / `"L2-ASSOC"` / `"L3-PREDICT"`).
- `classify()` propagates these into `Decision` as `provenance`.

**Server** (`src/lib/ops.functions.ts` + `src/lib/ops-schemas.ts`):
- Extend `autoDecisionInput` / `resolveInput` / `taskingInput` with optional `sourceSensor`, `sensorBand`, `fusionStep`, `observedAt`; the handlers write them to the new columns. The server does **not** trust a client claim of fusion step for authority — authority still comes from the ROE re-derivation — but it persists what the client reported for the lineage record and journals it in the audit payload.

**Client / UI**:
- `src/components/dashboard/EntityDetail.tsx` + `DecisionLog.tsx`: show `SENSOR · {band} · {fusionStep} · {observedAt}` for each decision.
- `ReplayPanel.tsx`: include provenance in the reconstructed timeline and the evidence export.
- `src/lib/audit-log.ts`: include provenance fields in the `DECISION_*` audit payloads.

**Verified state**: every persisted decision and tasking order carries a non-empty sensor/band/fusion-step/observed-at that traces back to a feed in the scenario; the value is visible in the lineage UI and the replay export.

---

## Workstream 4 — Store-and-forward resilience

**DB** (`supabase/migrations/`):
- Add `client_request_id text` unique to `tasking_orders` (idempotency key) so a re-flushed dispatch can't double-issue. `append_audit` idempotency from Workstream 2 covers audit; decisions upsert on `event_id` already.
- A `recordTasking` handler change: accept `clientRequestId`, `on conflict (client_request_id) do nothing`.

**Client outbox** (`src/lib/outbox.ts`, new):
- IndexedDB-backed ordered queue of pending operations (`{ id, fn, payload, createdAt }`) wrapping the four server writes: `writeAudit`, `recordAutoDecision`, `recordTasking`, `resolveDecisionServer`.
- `enqueue(op)`: if the link is up AND comms-loss degraded mode is off, call the server fn directly and only fall back to the queue on failure; if the link is known down, enqueue immediately.
- `flush()`: drains the queue in insertion order, calling each server fn, removing the row only on confirmed success; stops on first hard failure (non-retryable) and backs off.
- Connectivity monitor: `navigator.onLine`/`offline` events + a lightweight `ping` server fn heartbeat; the comms-loss degraded toggle now also forces the outbox path (turning the demo into a real store-and-forward path).

**Server** (`src/lib/ops.functions.ts`):
- Add `ping = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(...)` returning `{ ok: true, ts }` for the heartbeat (cheap, session-scoped).

**Client / UI**:
- `src/components/dashboard/StatusStrip.tsx`: an `OUTBOX · N queued` indicator + a `FLUSHING` state + last-reconciled timestamp.
- `src/lib/audit-log.ts` / `decision-engine.ts` / `tasking`: route their server writes through `enqueue` instead of bare `await fn(...).catch(console.error)`.

**Verified state**: toggling comms-loss (or going offline) routes writes to the outbox with no data loss; reconnecting flushes the queue; re-flushing the same tasking order does not create a duplicate dispatch (idempotency key); the audit chain stays continuous and unbroken across the gap.

---

## Technical notes

- All new server fns are thin wrappers in `*.functions.ts`; runtime helpers go in `*.server.ts` or inside handlers. No Node-only APIs — Merkle/signing use Web Crypto (`crypto.subtle` / `crypto.createHmac`), both Worker-safe.
- Secrets (`AUDIT_SIGNING_KEY`, `AUDIT_STEPUP_KEY`) added via `add_secret`, read inside handlers only.
- RLS + GRANTs follow the existing pattern: `GRANT SELECT` to `authenticated` for read tables, `GRANT ALL` to `service_role`, no anon grants, write only via security-definer routines or commander-scoped policies.
- MFA uses Supabase Auth TOTP (`mfa.enroll/challenge/verify`) — no custom OTP crypto. The step-up token is the only custom-signed artifact and it is short-lived and scoped to the user.
- The dual-key L5 rule (two distinct commanders) is unchanged and still enforced by the `decision_approvals(user_id)` unique constraint; MFA is an additional gate on each commander's action, not a replacement for the second person.

## Sequencing

Workstream 2's `append_audit` idempotency change should land before Workstream 4's outbox (the outbox relies on safe re-flush). Proposed order: **2 (audit idempotency + roots) → 4 (outbox) → 3 (provenance) → 1 (MFA step-up)**. Each workstream is independently shippable and leaves the demo intact.

## Scope check

This pass adds real step-up auth, signed evidence, lineage, and offline resilience to the existing app. It does **not** add hardware sensors, tactical radios, on-prem LLMs, or accreditation paperwork — those are outside what the app can hold and remain as documented reference. Confirm the four-workstream scope and the ordering above before I start.
