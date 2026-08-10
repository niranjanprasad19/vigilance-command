// Tamper-evident audit journal — CLIENT FORWARDER.
//
// The chain itself lives in the database. `append_audit` (a security-definer
// routine) assigns the sequence number, the server timestamp and the SHA-256
// hash that links each entry to its predecessor. There are no update or delete
// policies on the journal table, for any role, so entries are append-only by
// construction — this module can only ever add to it.

import { getBus, type TaskingOrder } from "./telemetry";
import { startDecisionEngine } from "./decision-engine";
import type { Decision } from "./threat-levels";
import type { Role } from "./rbac";
import { getOpsMode } from "./ops-runtime";
import { writeAudit, recordAutoDecision, recordTasking } from "./ops.functions";

export type Classification = "UNCLASSIFIED" | "RESTRICTED" | "CONFIDENTIAL" | "SECRET";
export type OpsMode = "TRAINING" | "LIVE";

export type AuditEntry = {
  seq: number;
  ts: string;
  kind: string;
  actor_id: string | null;
  actor_role: Role | null;
  mode: OpsMode;
  classification: Classification;
  payload: Record<string, unknown>;
  prev_hash: string;
  hash: string;
};

let started = false;
let getMode: () => OpsMode = () => getOpsMode();
let getActor: () => Role = () => "operator";

const subscribers = new Set<() => void>();

export function configureAudit(opts: { mode: () => OpsMode; actor: () => Role }) {
  getMode = opts.mode;
  getActor = opts.actor;
}

export function subscribeAudit(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Write one entry to the server-side chain. Never throws into the UI. */
export async function appendAudit(
  kind: string,
  payload: Record<string, unknown>,
  mode: OpsMode = getMode(),
  classification: Classification = "RESTRICTED",
): Promise<void> {
  try {
    await writeAudit({ data: { kind, payload, mode, classification } });
    subscribers.forEach((fn) => fn());
  } catch (e) {
    console.error("audit append failed", e);
  }
}

export function currentActor(): Role {
  return getActor();
}

export function startAuditCapture() {
  if (started || typeof window === "undefined") return;
  started = true;
  startDecisionEngine();
  const bus = getBus();

  bus.on("decision:auto", (d: Decision) => {
    void recordAutoDecision({
      data: {
        eventId: d.id,
        entityId: d.event.entityId,
        entityLabel: d.entity?.label,
        level: d.level,
        action: d.action,
        rationale: d.rationale,
        confidence: d.event.confidence,
        severity: d.event.severity,
        modelVersion: "vigilance-triage-1.0.0",
        mode: getMode(),
        autoExecute: true,
      },
    }).catch((e) => console.error(e));
    void appendAudit("DECISION_AUTO", {
      id: d.id, level: d.level, action: d.action, label: d.event.label,
      confidence: d.event.confidence, rationale: d.rationale,
      model_version: "vigilance-triage-1.0.0",
    }, getMode(), "CONFIDENTIAL");
  });

  bus.on("decision:pending", (d: Decision) => {
    void appendAudit("DECISION_PENDING", {
      id: d.id, level: d.level, action: d.action, label: d.event.label,
      confidence: d.event.confidence, model_version: "vigilance-triage-1.0.0",
    }, getMode(), "CONFIDENTIAL");
  });

  bus.on("tasking:update", (t: TaskingOrder) => {
    if (t.status !== "DISPATCHED") return;
    void recordTasking({
      data: {
        asset: t.asset,
        directive: t.directive,
        source: t.source === "AI-AUTO" ? "AI-AUTO" : "OPERATOR",
        triggerLevel: t.triggerLevel,
        triggerLabel: t.triggerLabel,
        mode: getMode(),
      },
    }).catch((e) => console.error(e));
    void appendAudit("TASKING_DISPATCH", {
      id: t.id, asset: t.asset, directive: t.directive,
      source: t.source, triggerLevel: t.triggerLevel, triggerLabel: t.triggerLabel,
    }, getMode(), "CONFIDENTIAL");
  });
}
