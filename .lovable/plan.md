
# Threat Triage Demo — 5-Level AI/Human Decisioning

Add a demo-ready capability showing how Vigilance classifies every threat into 5 escalating levels, auto-acts on L1–L3 with the AI, and routes L4–L5 to a human approval queue (with AI recommendation pre-attached). Built on existing telemetry — no backend changes beyond the AI route.

## What you'll see in the demo

1. **Threat-Level Legend** (top of dashboard, replaces/augments REDCON pill):
   `L1 OBSERVE · L2 MONITOR · L3 ENGAGE-AUTO · L4 APPROVE · L5 COMMAND`
   with counts per level updating live.
2. **Auto-decisions ticker** — every incoming `threat:event` is scored to L1–L5; L1–L3 produce an immediate AI action (logged with timestamp, entity, action, confidence).
3. **Human Approval Queue** (new right-rail panel or modal) — L4 & L5 events pause and require operator **APPROVE / MODIFY / REJECT**. Each card shows AI recommendation, rationale, predicted outcome, and a 30s countdown.
4. **Decision log timeline** — colored marks on Chronos timeline show auto vs. human decisions.
5. **Demo controls** — buttons to inject scripted scenarios: "Drone incursion (L4)", "Vessel intrusion (L5)", "RF anomaly (L2)", so you can drive a live walkthrough.

## Threat-level rules (deterministic mapping, demo-tunable)

```text
L1 OBSERVE       threat 0.00–0.25   AI: log only
L2 MONITOR       threat 0.25–0.45   AI: increase sensor cadence on entity
L3 ENGAGE-AUTO   threat 0.45–0.65   AI: dispatch nearest UAV to shadow
L4 APPROVE       threat 0.65–0.85   AI recommends, HUMAN must approve
L5 COMMAND       threat 0.85–1.00   AI recommends, HUMAN approves + dual-confirm
```
CRITICAL severity always escalates one level. Confidence < 0.5 escalates one level (uncertainty → human).

## Files to add / change

- `src/lib/threat-levels.ts` *(new)* — `classify(event, entity)` → `{ level: 1..5, action, autoExecute, rationale }`. Pure function, fully unit-testable.
- `src/lib/decision-engine.ts` *(new)* — subscribes to `getBus().on("threat:event")`, runs classifier, emits new bus events: `decision:auto`, `decision:pending`, `decision:resolved`. Maintains in-memory queue.
- Extend `src/lib/telemetry.ts` `TelemetryEventMap` with the three decision events + `Decision` type.
- `src/components/dashboard/ThreatLevelStrip.tsx` *(new)* — 5-segment legend with live counters, replaces or sits above the existing `REDCON` row in `StatusStrip`.
- `src/components/dashboard/ApprovalQueue.tsx` *(new)* — stacked cards for L4/L5 pending decisions with Approve / Modify / Reject and countdown timer (auto-escalates to "TIMEOUT — HOLD" if ignored).
- `src/components/dashboard/DecisionLog.tsx` *(new)* — scrolling auto-decision feed (L1–L3).
- `src/components/dashboard/DemoInjector.tsx` *(new)* — small floating panel with 4 scripted scenario buttons.
- `src/routes/dashboard.tsx` — slot the new components in: ThreatLevelStrip under StatusStrip; ApprovalQueue replaces top half of right rail (Vanguard moves to a tab); DecisionLog replaces bottom of left rail or stacks under SensorFeeds; DemoInjector floating bottom-right.
- `src/routes/api/vanguard.ts` — extend system prompt so Vanguard explains its recommendation when asked about a pending decision (no schema change).
- `src/components/dashboard/ChronosTimeline.tsx` — add a 5th lane "DECISIONS" that plots auto (cyan dot) vs. human (amber ring) decisions.

## Layout impact (compact)

```text
┌──────────────── StatusStrip ────────────────┐
├──────── ThreatLevelStrip (L1 L2 L3 L4 L5) ──┤
│ Sensors │   VideoWall + NexusGraph    │ Approvals │
│ + Decis │   + EntityDetail            │ + Vanguard│
│ Log     │                             │ + Tasking │
├─────────────── Chronos (+ Decisions) ───────┤
                                       [Demo Inject]
```

Right rail becomes a 3-row stack: ApprovalQueue (top, fixed when items pending) / Vanguard (middle) / Tasking (bottom). When the queue is empty it collapses to a 1-line "ALL CLEAR" header.

## Demo script (what you'll click during the walkthrough)

1. Open `/dashboard` — telemetry already streaming, ThreatLevelStrip shows nominal counts.
2. Click **"Inject: RF anomaly"** → L2 auto-decision logged in DecisionLog (no human input).
3. Click **"Inject: Drone incursion"** → L4 card appears in ApprovalQueue with countdown, AI recommendation visible. APPROVE → DecisionLog updates, tasking order auto-dispatched, Chronos plots amber ring.
4. Click **"Inject: Vessel intrusion"** → L5 card requires dual-confirm; show MODIFY flow (edit recommended directive before approving).
5. Ask Vanguard: *"Why did you recommend intercept on GHOST-441?"* — streams rationale.

## Out of scope (call out before building)

- Persistence (decisions reset on reload — fine for demo).
- Real auth / role gating on the approval action.
- Per-sector policy editor UI (rules live in `threat-levels.ts` constants).

Confirm and I'll implement.
