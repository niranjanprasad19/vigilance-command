// Role-based + attribute-based access control for the Vigilance demo.
// Roles model a real defence ops cell: operator → supervisor → commander, plus a read-only auditor.

import type { Decision, ThreatLevel } from "./threat-levels";

export type Role = "operator" | "supervisor" | "commander" | "auditor";

export type Capability =
  | "decision.approve"
  | "decision.modify"
  | "decision.reject"
  | "decision.dual_confirm" // L5 second-key
  | "ops.toggle_mode"       // training ↔ live
  | "ops.toggle_degraded"   // sensor drop / comms loss sims
  | "ops.inject_scenario"
  | "audit.view"
  | "audit.export";

export const ROLE_META: Record<Role, { label: string; tone: string; rank: number }> = {
  operator:   { label: "Operator",   tone: "text-cyan",        rank: 1 },
  supervisor: { label: "Supervisor", tone: "text-cyan",        rank: 2 },
  commander:  { label: "Commander",  tone: "text-warning",     rank: 3 },
  auditor:    { label: "Auditor",    tone: "text-muted-foreground", rank: 0 },
};

const MATRIX: Record<Role, Set<Capability>> = {
  operator: new Set([
    "decision.approve", "decision.modify", "decision.reject",
    "ops.inject_scenario",
  ]),
  supervisor: new Set([
    "decision.approve", "decision.modify", "decision.reject",
    "ops.toggle_degraded", "ops.inject_scenario",
    "audit.view",
  ]),
  commander: new Set([
    "decision.approve", "decision.modify", "decision.reject",
    "decision.dual_confirm",
    "ops.toggle_mode", "ops.toggle_degraded", "ops.inject_scenario",
    "audit.view", "audit.export",
  ]),
  auditor: new Set(["audit.view", "audit.export"]),
};

export function can(role: Role, cap: Capability): boolean {
  return MATRIX[role].has(cap);
}

// ABAC predicates — combine role with the *attributes* of the decision.
// Operator may approve up to L4. L5 always requires a commander.
export function canActOn(role: Role, decision: Pick<Decision, "level">, action: "approve" | "modify" | "reject"): {
  allowed: boolean;
  reason?: string;
} {
  const cap: Capability =
    action === "approve" ? "decision.approve" :
    action === "modify"  ? "decision.modify"  : "decision.reject";
  if (!can(role, cap)) return { allowed: false, reason: `${role} lacks ${cap}` };

  const lvl: ThreatLevel = decision.level;
  if (action === "approve" && lvl === 5 && role !== "commander") {
    return { allowed: false, reason: "L5 approval requires Commander" };
  }
  if (action === "approve" && lvl === 4 && role === "operator") {
    // Operator may *initiate* but full approval also requires supervisor in real ops.
    // For the demo we let operators approve L4 — flag it in the audit.
    return { allowed: true };
  }
  return { allowed: true };
}
