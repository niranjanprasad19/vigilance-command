// Tamper-evident audit log — hash-chained entries (Bitcoin-style: each entry's
// hash includes the previous hash, so any retroactive edit invalidates the tail).
// Uses cyrb53 (deterministic, sync, demo-grade). A real system would use SHA-256
// with monotonic timestamps and an HSM-signed Merkle root every N entries.

import { getBus, type TaskingOrder } from "./telemetry";
import { startDecisionEngine } from "./decision-engine";
import type { Decision } from "./threat-levels";
import type { Role } from "./rbac";

export type AuditKind =
  | "DECISION_AUTO"
  | "DECISION_PENDING"
  | "DECISION_RESOLVED"
  | "TASKING_DISPATCH"
  | "ROLE_CHANGE"
  | "MODE_CHANGE"
  | "DEGRADED_TOGGLE"
  | "INJECT_SCENARIO";

export type AuditEntry = {
  seq: number;
  ts: number;
  kind: AuditKind;
  actor: Role | "ai-auto" | "system";
  mode: "TRAINING" | "LIVE";
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
};

// cyrb53 — fast non-cryptographic 53-bit hash. Demo-grade tamper-evidence.
function cyrb53(str: string, seed = 0xC0DE_F00D): string {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const v = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return v.toString(16).padStart(14, "0");
}

const GENESIS = "0".repeat(14);
const log: AuditEntry[] = [];
const subscribers = new Set<(e: AuditEntry) => void>();

let started = false;
let getMode: () => "TRAINING" | "LIVE" = () => "TRAINING";
let getActor: () => Role = () => "operator";

export function configureAudit(opts: { mode: () => "TRAINING" | "LIVE"; actor: () => Role }) {
  getMode = opts.mode;
  getActor = opts.actor;
}

export function appendAudit(
  kind: AuditKind,
  payload: Record<string, unknown>,
  actor: AuditEntry["actor"] = getActor(),
): AuditEntry {
  const prev = log[log.length - 1];
  const prevHash = prev ? prev.hash : GENESIS;
  const seq = (prev?.seq ?? -1) + 1;
  const ts = Date.now();
  const mode = getMode();
  const body = JSON.stringify({ seq, ts, kind, actor, mode, payload, prevHash });
  const hash = cyrb53(body);
  const entry: AuditEntry = { seq, ts, kind, actor, mode, payload, prevHash, hash };
  log.push(entry);
  subscribers.forEach((fn) => fn(entry));
  return entry;
}

export function getAuditLog(): AuditEntry[] {
  return log.slice();
}

export function subscribeAudit(fn: (e: AuditEntry) => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export type ChainVerdict = {
  ok: boolean;
  brokenAt?: number;
  total: number;
  verifiedAt: number;
};

export function verifyChain(): ChainVerdict {
  let prevHash = GENESIS;
  for (let i = 0; i < log.length; i++) {
    const e = log[i];
    const body = JSON.stringify({
      seq: e.seq, ts: e.ts, kind: e.kind, actor: e.actor,
      mode: e.mode, payload: e.payload, prevHash,
    });
    const expected = cyrb53(body);
    if (e.prevHash !== prevHash || e.hash !== expected) {
      return { ok: false, brokenAt: i, total: log.length, verifiedAt: Date.now() };
    }
    prevHash = e.hash;
  }
  return { ok: true, total: log.length, verifiedAt: Date.now() };
}

// Test hook for the demo "tamper" button.
export function tamperWithLogForDemo(seq: number) {
  const e = log.find((x) => x.seq === seq);
  if (!e) return;
  e.payload = { ...e.payload, __tampered: true };
}

export function exportAuditJson(): string {
  return JSON.stringify(log, null, 2);
}

export function startAuditCapture() {
  if (started || typeof window === "undefined") return;
  started = true;
  startDecisionEngine();
  const bus = getBus();

  bus.on("decision:auto", (d: Decision) => {
    appendAudit("DECISION_AUTO", {
      id: d.id, level: d.level, action: d.action, label: d.event.label,
      confidence: d.event.confidence, rationale: d.rationale,
    }, "ai-auto");
  });
  bus.on("decision:pending", (d: Decision) => {
    appendAudit("DECISION_PENDING", {
      id: d.id, level: d.level, action: d.action, label: d.event.label,
    }, "ai-auto");
  });
  bus.on("decision:resolved", (d: Decision) => {
    appendAudit("DECISION_RESOLVED", {
      id: d.id, level: d.level, status: d.status,
      action: d.modifiedAction ?? d.action,
      modified: !!d.modifiedAction,
    });
  });
  bus.on("tasking:update", (t: TaskingOrder) => {
    if (t.status !== "DISPATCHED") return; // only the dispatch event, not every stage
    appendAudit("TASKING_DISPATCH", {
      id: t.id, asset: t.asset, directive: t.directive,
      source: t.source, triggerLevel: t.triggerLevel, triggerLabel: t.triggerLabel,
    }, t.source === "AI-AUTO" ? "ai-auto" : getActor());
  });
}
