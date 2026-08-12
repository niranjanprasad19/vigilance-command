// Rules of Engagement — shared, client-safe policy evaluation.
// The SAME pure function runs in the browser (for display) and on the server
// (for authority). The server's answer is the one that counts.

import type { RoeThresholds } from "./ops-schemas";

export type ThreatLevelValue = 1 | 2 | 3 | 4 | 5;

export type RoePolicy = {
  version: number;
  name: string;
  thresholds: RoeThresholds;
  autoExecuteCeiling: number;
  dualConfirmFrom: number;
};

export const DEFAULT_ROE: RoePolicy = {
  version: 0,
  name: "BASELINE (built-in fallback)",
  thresholds: {
    l2: 0.25,
    l3: 0.45,
    l4: 0.65,
    l5: 0.85,
    critical_bump: 1,
    low_confidence_bump: 1,
    low_confidence_below: 0.5,
  },
  autoExecuteCeiling: 3,
  dualConfirmFrom: 5,
};

/** Fusion score: sensor confidence weighted against standing entity threat. */
export function fusionScore(confidence: number, entityThreat: number): number {
  return Math.max(0, Math.min(1, confidence * 0.4 + entityThreat * 0.6));
}

function clamp(l: number): ThreatLevelValue {
  return Math.min(5, Math.max(1, Math.round(l))) as ThreatLevelValue;
}

export function evaluateLevel(
  policy: RoePolicy,
  input: { score: number; severity?: string | null; confidence: number },
): ThreatLevelValue {
  const t = policy.thresholds;
  let level: ThreatLevelValue =
    input.score >= t.l5 ? 5 : input.score >= t.l4 ? 4 : input.score >= t.l3 ? 3 : input.score >= t.l2 ? 2 : 1;
  if (input.severity === "CRITICAL") level = clamp(level + t.critical_bump);
  if (input.confidence < t.low_confidence_below) level = clamp(level + t.low_confidence_bump);
  return level;
}

export function normalizeRoeRow(row: {
  version: number;
  name: string;
  thresholds: unknown;
  auto_execute_ceiling: number;
  dual_confirm_from: number;
} | null | undefined): RoePolicy {
  if (!row) return DEFAULT_ROE;
  return {
    version: row.version,
    name: row.name,
    thresholds: { ...DEFAULT_ROE.thresholds, ...(row.thresholds as Partial<RoeThresholds>) },
    autoExecuteCeiling: row.auto_execute_ceiling,
    dualConfirmFrom: row.dual_confirm_from,
  };
}

// ---- Browser-side cache of the active policy (display only) ----
let active: RoePolicy = DEFAULT_ROE;
export function setActiveRoe(p: RoePolicy) { active = p; }
export function getActiveRoePolicy(): RoePolicy { return active; }
