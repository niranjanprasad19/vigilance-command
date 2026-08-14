// Subscribes to threat events, classifies them, and emits decision events.
// L1-L3 auto-execute; L4-L5 enter a pending queue with a 30s timeout.

import { dispatchTasking, getBus, scenario, type ThreatEvent } from "./telemetry";
import { classify, type Decision, type ThreatLevel } from "./threat-levels";
import { getOpsMode } from "./ops-runtime";
import { isAiDegraded } from "./degraded";
import { resolveDecisionServer } from "./ops.functions";

const PENDING_TIMEOUT_MS = 30_000;
let started = false;
const pending = new Map<string, { decision: Decision; timer: ReturnType<typeof setTimeout> }>();

function entityFor(id: string) {
  return scenario.entities.find((e) => e.id === id);
}

function modeTag(prefix: string) {
  return getOpsMode() === "TRAINING" ? `[REHEARSAL] ${prefix}` : prefix;
}

function autoSideEffect(d: Decision) {
  if (d.level === 3) {
    const uavs = ["VG-01", "VG-02", "VG-03", "VG-04"];
    const asset = uavs[Math.floor(Math.random() * uavs.length)];
    dispatchTasking(asset, modeTag(`Shadow ${d.entity?.label ?? d.event.entityId}`), {
      source: "AI-AUTO",
      triggerLevel: d.level,
      triggerLabel: d.event.label,
      sourceSensor: d.provenance?.sensorId,
      sensorBand: d.provenance?.band,
    });
  }
}

function handleEvent(e: ThreatEvent) {
  // Don't act on predicted events — only on live threats.
  if (e.predicted) return;
  // AI-degraded mode: cap confidence so the classifier escalates more events to humans.
  const evt: ThreatEvent = isAiDegraded() ? { ...e, confidence: Math.min(e.confidence, 0.6) } : e;
  const decision = classify(evt, entityFor(evt.entityId));
  const bus = getBus();

  if (decision.autoExecute) {
    autoSideEffect(decision);
    bus.emit("decision:auto", decision);
    return;
  }

  // L4/L5 — queue and emit pending. Auto-timeout after 30s if untouched.
  const timer = setTimeout(() => {
    const cur = pending.get(decision.id);
    if (!cur) return;
    pending.delete(decision.id);
    bus.emit("decision:resolved", { ...cur.decision, status: "TIMEOUT", resolvedTs: Date.now() });
  }, PENDING_TIMEOUT_MS);
  pending.set(decision.id, { decision, timer });
  bus.emit("decision:pending", decision);
}

export function startDecisionEngine() {
  if (started || typeof window === "undefined") return;
  started = true;
  getBus().on("threat:event", handleEvent);
}

export type ResolveResult =
  | { ok: true; finalized: true }
  | { ok: true; finalized: false; keysHeld: number; keysRequired: number }
  | { ok: false; reason: string };

/**
 * Resolution is SERVER-AUTHORITATIVE. The browser only proposes an outcome:
 * role authority, threat-level ceiling and the two-commander rule for L5 are
 * all re-evaluated on the server against the bearer token before anything is
 * persisted or dispatched.
 */
export async function resolveDecision(
  id: string,
  outcome: "APPROVED" | "MODIFIED" | "REJECTED",
  modifiedAction?: string,
): Promise<ResolveResult> {
  const cur = pending.get(id);
  if (!cur) return { ok: false, reason: "Decision is no longer pending" };
  const d = cur.decision;

  let res: Awaited<ReturnType<typeof resolveDecisionServer>>;
  try {
    res = await resolveDecisionServer({
      data: {
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
        mode: getOpsMode(),
        outcome,
        modifiedAction: outcome === "MODIFIED" ? modifiedAction : undefined,
      },
    });
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "Server rejected the request" };
  }

  if (!res.ok) return { ok: false, reason: res.reason ?? "Denied" };
  if (!res.finalized) {
    return { ok: true, finalized: false, keysHeld: res.keysHeld ?? 1, keysRequired: res.keysRequired ?? 2 };
  }

  clearTimeout(cur.timer);
  pending.delete(id);
  const finalDecision: Decision = {
    ...d,
    status: outcome,
    resolvedBy: "operator",
    resolvedTs: Date.now(),
    modifiedAction: outcome === "MODIFIED" ? modifiedAction : undefined,
  };
  if (outcome === "APPROVED" || outcome === "MODIFIED") {
    const uavs = ["VG-01", "VG-02", "VG-03", "VG-04"];
    const asset = uavs[Math.floor(Math.random() * uavs.length)];
    dispatchTasking(asset, modeTag(modifiedAction ?? finalDecision.action), {
      source: "OPERATOR",
      triggerLevel: finalDecision.level,
      triggerLabel: finalDecision.event.label,
    });
  }
  getBus().emit("decision:resolved", finalDecision);
  return { ok: true, finalized: true };
}

// Demo injectors — fire scripted threats at desired levels.
export type ScenarioKey = "rf" | "drone" | "vessel" | "incursion";

const SCENARIOS: Record<ScenarioKey, { entityId: string; label: string; severity: ThreatEvent["severity"]; confidence: number; targetLevel: ThreatLevel }> = {
  rf: { entityId: "sig:RF-2.4G", label: "RF burst intercept · band 2.4GHz", severity: "WATCH", confidence: 0.72, targetLevel: 2 },
  incursion: { entityId: "trk:UNK-118", label: "Unidentified vehicle crossing tripwire", severity: "WARN", confidence: 0.78, targetLevel: 3 },
  drone: { entityId: "trk:GHOST-441", label: "Hostile drone incursion · sector ALPHA-7", severity: "WARN", confidence: 0.86, targetLevel: 4 },
  vessel: { entityId: "trk:VESSEL-5", label: "Vessel intrusion · weapons signature", severity: "CRITICAL", confidence: 0.93, targetLevel: 5 },
};

export function injectScenario(key: ScenarioKey) {
  const s = SCENARIOS[key];
  const ent = entityFor(s.entityId);
  // Temporarily ensure entity threat matches the scripted level for the classifier.
  const restore = ent?.threat;
  if (ent) {
    ent.threat = { 1: 0.1, 2: 0.35, 3: 0.55, 4: 0.78, 5: 0.92 }[s.targetLevel];
  }
  getBus().emit("threat:event", {
    id: `inj-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    ts: Date.now(),
    entityId: s.entityId,
    label: s.label,
    severity: s.severity,
    confidence: s.confidence,
    predicted: false,
  });
  if (ent && restore !== undefined) {
    setTimeout(() => { ent.threat = restore; }, 250);
  }
}
