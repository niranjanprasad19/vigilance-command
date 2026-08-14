// Degraded-mode simulator — demonstrates resilience by injecting realistic
// failure modes that operators must reason through.

import { getBus, scenario, type SensorFeed } from "./telemetry";
import { appendAudit } from "./audit-log";
import { setReachabilityChecker, flushOutbox } from "./outbox";

export type DegradedMode = "sensor-drop" | "comms-loss" | "gps-jam" | "ai-degraded";

export const DEGRADED_META: Record<DegradedMode, { label: string; desc: string }> = {
  "sensor-drop": { label: "Sensor Drop",  desc: "Random feeds go OFFLINE; coverage gaps appear." },
  "comms-loss":  { label: "Comms Loss",   desc: "Uplink drops; latency spikes; tasking ACK delayed." },
  "gps-jam":     { label: "GPS Jam",      desc: "Position confidence collapses on UAV assets." },
  "ai-degraded": { label: "AI Degraded",  desc: "Model confidence ceiling capped at 60%." },
};

const active = new Set<DegradedMode>();
const intervals = new Map<DegradedMode, ReturnType<typeof setInterval>>();
const subscribers = new Set<(s: ReadonlySet<DegradedMode>) => void>();

// The outbox consults this to decide whether to flush: while comms-loss is
// simulated-down the queue holds; the moment it clears, the queue drains.
setReachabilityChecker(() => !active.has("comms-loss"));

export function getActiveDegraded(): ReadonlySet<DegradedMode> {
  return active;
}
export function subscribeDegraded(fn: (s: ReadonlySet<DegradedMode>) => void) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
function notify() { subscribers.forEach((fn) => fn(active)); }

export function isDegraded(): boolean { return active.size > 0; }
export function hasDegraded(m: DegradedMode): boolean { return active.has(m); }

export function setDegraded(m: DegradedMode, on: boolean) {
  if (on === active.has(m)) return;
  if (on) {
    active.add(m);
    start(m);
  } else {
    active.delete(m);
    const i = intervals.get(m);
    if (i) clearInterval(i);
    intervals.delete(m);
    if (m === "sensor-drop") restoreFeeds();
    if (m === "comms-loss") void flushOutbox(); // drain the buffered queue
  }
  void appendAudit("DEGRADED_TOGGLE", { degraded_mode: m, on });
  notify();
}

export function clearDegraded() {
  Array.from(active).forEach((m) => setDegraded(m, false));
}

function start(m: DegradedMode) {
  const bus = getBus();
  if (m === "sensor-drop") {
    intervals.set(m, setInterval(() => {
      const f = scenario.feeds[Math.floor(Math.random() * scenario.feeds.length)];
      const next: SensorFeed = {
        ...f,
        status: Math.random() < 0.55 ? "OFFLINE" : "DEGRADED",
        signal: Math.max(0, f.signal - 30 - Math.random() * 30),
        lastTickMs: Date.now(),
      };
      Object.assign(f, next);
      bus.emit("feed:tick", next);
    }, 900));
  }
  if (m === "comms-loss") {
    intervals.set(m, setInterval(() => {
      bus.emit("system:status", {
        uplink: Math.floor(20 + Math.random() * 35),
        latencyMs: Math.floor(450 + Math.random() * 600),
        nodes: scenario.entities.length,
        alerts: 9,
      });
    }, 700));
  }
  if (m === "gps-jam") {
    intervals.set(m, setInterval(() => {
      const uavs = scenario.entities.filter((e) => e.kind === "drone");
      const u = uavs[Math.floor(Math.random() * uavs.length)];
      bus.emit("threat:event", {
        id: `gps-${Date.now()}`,
        ts: Date.now(),
        entityId: u.id,
        label: `${u.label} GPS denied · DR-nav fallback`,
        severity: "WATCH",
        confidence: 0.4,
        predicted: false,
      });
    }, 3500));
  }
  // ai-degraded is enforced by isAiDegraded() — no interval needed.
}

function restoreFeeds() {
  const bus = getBus();
  scenario.feeds.forEach((f) => {
    f.status = "NOMINAL";
    f.signal = 80;
    bus.emit("feed:tick", { ...f });
  });
}

// Used by the classifier to cap confidence under ai-degraded mode.
export function isAiDegraded(): boolean { return active.has("ai-degraded"); }
