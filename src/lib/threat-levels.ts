// Deterministic 5-level threat classifier.
// L1-L3 → AI auto-executes. L4-L5 → human-in-the-loop required.

import type { Entity, ThreatEvent } from "./telemetry";

export type ThreatLevel = 1 | 2 | 3 | 4 | 5;

export type Decision = {
  id: string;
  ts: number;
  level: ThreatLevel;
  event: ThreatEvent;
  entity?: Entity;
  action: string;
  rationale: string;
  autoExecute: boolean;
  requiresDualConfirm: boolean;
  status: "AUTO-EXECUTED" | "PENDING" | "APPROVED" | "MODIFIED" | "REJECTED" | "TIMEOUT";
  resolvedBy?: string;
  resolvedTs?: number;
  modifiedAction?: string;
};

export const LEVEL_META: Record<
  ThreatLevel,
  { code: string; name: string; tone: string; bg: string; border: string }
> = {
  1: { code: "L1", name: "OBSERVE", tone: "text-muted-foreground", bg: "bg-muted/20", border: "border-border" },
  2: { code: "L2", name: "MONITOR", tone: "text-cyan", bg: "bg-cyan/10", border: "border-cyan/40" },
  3: { code: "L3", name: "ENGAGE-AUTO", tone: "text-cyan", bg: "bg-cyan/15", border: "border-cyan" },
  4: { code: "L4", name: "APPROVE", tone: "text-warning", bg: "bg-warning/15", border: "border-warning" },
  5: { code: "L5", name: "COMMAND", tone: "text-destructive", bg: "bg-destructive/15", border: "border-destructive" },
};

const ACTIONS: Record<ThreatLevel, (label: string) => string> = {
  1: (l) => `Log ${l} to passive register`,
  2: (l) => `Increase sensor cadence on ${l}; flag analyst feed`,
  3: (l) => `Dispatch nearest UAV to shadow ${l}; broadcast update`,
  4: (l) => `Recommend intercept-and-illuminate on ${l}`,
  5: (l) => `Recommend hard-deny corridor; vector strike asset to ${l}`,
};

export function classify(event: ThreatEvent, entity?: Entity): Decision {
  const policy = getActiveRoePolicy();
  const score = fusionScore(event.confidence, entity?.threat ?? 0);
  const level = evaluateLevel(policy, {
    score,
    severity: event.severity,
    confidence: event.confidence,
  }) as ThreatLevel;

  const label = entity?.label ?? event.entityId;
  const action = ACTIONS[level](label);

  const rationale =
    `score ${(score * 100).toFixed(0)} · sev ${event.severity} · conf ${(event.confidence * 100).toFixed(0)}% ` +
    `· entity-threat ${((entity?.threat ?? 0) * 100).toFixed(0)}% · ROE v${policy.version}`;

  const autoExecute = level <= policy.autoExecuteCeiling;

  return {
    id: `dec-${event.id}`,
    ts: Date.now(),
    level,
    score,
    policyVersion: policy.version,
    event,
    entity,
    action,
    rationale,
    autoExecute,
    requiresDualConfirm: level >= policy.dualConfirmFrom,
    status: autoExecute ? "AUTO-EXECUTED" : "PENDING",
  };
}

