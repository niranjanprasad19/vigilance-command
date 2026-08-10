# Vigilance — Status Review and Hardening Roadmap

## Where the project stands today

Everything currently in the app is **client-side simulation**. There is no database, no user accounts, and no server-side authority. Confirmed from the code:

Built and working:
- Marketing landing page (hero, ticker, stats, capabilities, workflow, architecture, FAQ, CTA, footer).
- Command dashboard: sensor feeds, multi-spectral video wall (EO/IR/NV/SAR canvas feeds with bounding boxes), Nexus knowledge graph with filters/minimap/ghost tracks, Chronos timeline, status strip.
- 5-level threat classifier (`src/lib/threat-levels.ts`) with L1–L3 auto-execute and L4–L5 human approval.
- Decision engine with a 30s pending timeout and approve / modify / reject (`src/lib/decision-engine.ts`).
- Command dispatch feed with order lifecycle DISPATCHED → ACK → ENROUTE → ON-STATION → COMPLETE.
- RBAC + ABAC roles (operator, supervisor, commander, auditor) in `src/lib/rbac.ts`.
- Training vs Live mode separator, degraded-mode simulation (sensor drop, comms loss, GPS jam, AI degraded).
- Hash-chained audit log with a tamper demo and JSON export (`src/lib/audit-log.ts`).
- One real backend surface: `/api/vanguard` AI streaming route.

Gaps that block real use:
- No authentication at all — anyone opening `/dashboard` is a "commander"; role is picked from a dropdown and stored in `localStorage`.
- The audit log lives in a JS array in memory: it disappears on refresh, and the "tamper-evident" chain is `cyrb53`, a non-cryptographic 53-bit hash, not SHA-256. It can be forged trivially.
- RBAC is enforced only in the UI. There is no server that could reject an unauthorised action.
- All telemetry, decisions, and tasking orders are generated in the browser and never persisted.
- The `/api/vanguard` AI route is unauthenticated and has no rate limiting.

Roughly: an excellent demonstrator, about 20–25% of the way to something deployable.

## What a current-generation system of this class is expected to have

Grouped by priority:

1. Identity and authority — real login, server-issued roles, session expiry, MFA, and a second-person rule for lethal/L5 actions that is enforced server-side, not by a checkbox.
2. Durable, signed audit — every decision, override, mode change, and dispatch written to append-only storage with SHA-256 hash chaining, server timestamps, and a periodically signed Merkle root. Exportable as evidence.
3. Server-authoritative decisioning — classification, ROE thresholds, and dispatch authorisation must run on the server. The browser proposes; the server decides.
4. Commander-editable ROE policy — thresholds, auto-execute ceilings, and geofences as versioned data with an approval workflow, not constants in code.
5. Explainability record — for each AI recommendation, store model version, inputs, confidence, and the rationale that was shown to the human who approved it.
6. Data lineage and sensor provenance — which sensor, which time, which fusion step produced each track.
7. Resilience — offline/disconnected operation with local queueing and reconciliation; the degraded simulator becomes a real store-and-forward path.
8. Operational hygiene — health checks, alert fatigue controls, shift handover briefs, after-action replay of an incident timeline.
9. Accreditation posture — data classification labels on every record, retention rules, and a documented security model (targeting NIST 800-53 / RMF style controls).

## Proposed build order

**Phase 1 — Real backend and identity (foundation)**
Enable Lovable Cloud. Add email/password auth, a `user_roles` table with a security-definer `has_role()` function (roles never on the profile row), and put `/dashboard` behind an authenticated route gate. Role in the UI becomes read-only, derived from the server.

**Phase 2 — Durable, cryptographic audit**
Move the audit chain server-side: SHA-256 over each entry, server-assigned sequence and timestamp, insert-only table with no update/delete policy for anyone, read scoped to auditor/commander. Verification and export run as server functions. Keep the tamper demo, but have it prove the real chain.

**Phase 3 — Server-authoritative decisions**
Move classification and ROE evaluation into server functions. Approvals, modifications, rejections, and dispatch orders become server-validated writes with role and threat-level checks re-checked on the server. L5 requires two distinct authenticated commanders.

**Phase 4 — Policy, explainability, replay**
Versioned ROE policy table with a commander edit + approval flow. Persist every decision with model version and rationale. Add incident replay that reconstructs a time window from stored events.

**Phase 5 — Hardening pass**
Rate-limit and authenticate `/api/vanguard`, add Zod validation on every server input, leaked-password protection, classification labels and retention on all tables, then a full security scan and written security memory.

## Technical notes

- Lovable Cloud (Postgres + auth) provides identity, RLS, and durable storage; server functions via `createServerFn` hold the authority checks. No Node-only services are involved, so this fits the Cloudflare Worker runtime.
- Audit table gets `GRANT SELECT/INSERT` only; no UPDATE or DELETE policy exists for any role, so append-only is enforced at the database level.
- Hashing moves from `cyrb53` to Web Crypto `SHA-256`, which is available in the Worker runtime.
- The existing telemetry simulator stays as the data source in TRAINING mode; LIVE mode reads from the database. That keeps the demo intact while the real path is built.

## Scope check

Phase 1 alone changes how the app is entered (a login screen appears before the dashboard). Confirm you want that before proceeding, and tell me whether to run all five phases sequentially or stop after Phase 2.
