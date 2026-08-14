// Tamper-evident audit journal — CLIENT FORWARDER.
//
// The chain itself lives in the database. `append_audit` (a security-definer
// routine) assigns the sequence number, the server timestamp and the SHA-256
// hash that links each entry to its predecessor. There are no update or delete
// policies on the journal table, for any role, so entries are append-only by
// construction — this module can only ever add to it.
//
// Every background write (audit, auto-decision, tasking) goes through the
// store-and-forward outbox: it is buffered in IndexedDB with a client request
// id and reconciled idempotently, so a dropped link or a replayed flush can
// never duplicate an entry.

import { getBus, type TaskingOrder } from "./telemetry";
import { startDecisionEngine } from "./decision-engine";
import type { Decision } from "./threat-levels";
import type { Role } from "./rbac";
import { getOpsMode } from "./ops-runtime";
import { subscribeOutbox, enqueueAudit, enqueueAutoDecision, enqueueTasking, startOutboxTicker } from "./outbox";

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
  client_request_id?: string | null;
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

/** Enqueue one entry on the durable chain. Never throws into the UI. */
export function appendAudit(
  kind: string,
  payload: Record<string, unknown>,
  mode: OpsMode = getMode(),
  classification: Classification = "RESTRICTED",
): void {
  void enqueueAudit(kind, payload, mode, classification).catch((e) => console.error("audit enqueue failed", e));
}

export function currentActor(): Role {
  return getActor();
}

export function startAuditCapture() {
  if (started || typeof window === "undefined") return;
  started = true;
  startOutboxTicker();
  startDecisionEngine();
  const bus = getBus();

  // When the outbox drains, refresh any open audit views.
  subscribeOutbox(() => subscribers.forEach((fn) => fn()));

  bus.on("decision:auto", (d: Decision) => {
    void enqueueAutoDecision({
      eventId: d.id,
      entityId: d.event.entityId,
      entityLabel: d.entity?.label,
      level: d.level,
      action: d.action,
      rationale: d.rationale,
      score: d.score,
      policyVersion: d.policyVersion,
      confidence: d.event.confidence,
      severity: d.event.severity,
      modelVersion: "vigilance-triage-1.0.0",
      mode: getMode(),
      autoExecute: true,
      sourceSensor: d.provenance?.sensorId,
      sensorBand: d.provenance?.band,
      fusionStep: d.provenance?.fusionStep,
      observedAt: d.provenance?.observedAt,
    }).catch((e) => console.error(e));
    appendAudit("DECISION_AUTO", {
      id: d.id, level: d.level, action: d.action, label: d.event.label,
      confidence: d.event.confidence, rationale: d.rationale, score: d.score,
      roe_version: d.policyVersion, model_version: "vigilance-triage-1.0.0",
      sensor: d.provenance?.sensorId, band: d.provenance?.band,
    }, getMode(), "CONFIDENTIAL");
  });

  bus.on("decision:pending", (d: Decision) => {
    appendAudit("DECISION_PENDING", {
      id: d.id, level: d.level, action: d.action, label: d.event.label,
      confidence: d.event.confidence, model_version: "vigilance-triage-1.0.0",
      sensor: d.provenance?.sensorId, band: d.provenance?.band,
    }, getMode(), "CONFIDENTIAL");
  });

  bus.on("tasking:update", (t: TaskingOrder) => {
    if (t.status !== "DISPATCHED") return;
    void enqueueTasking({
      asset: t.asset,
      directive: t.directive,
      source: t.source === "AI-AUTO" ? "AI-AUTO" : "OPERATOR",
      triggerLevel: t.triggerLevel,
      triggerLabel: t.triggerLabel,
      mode: getMode(),
      sourceSensor: t.sourceSensor,
      sensorBand: t.sensorBand,
    }).catch((e) => console.error(e));
    appendAudit("TASKING_DISPATCH", {
      id: t.id, asset: t.asset, directive: t.directive,
      source: t.source, triggerLevel: t.triggerLevel, triggerLabel: t.triggerLabel,
    }, getMode(), "CONFIDENTIAL");
  });
}
