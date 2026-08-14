// In-browser simulated telemetry stream — Socket.io-shaped event bus.
// Designed to be swappable for a real socket.io-client later: same `on/off/emit` surface.

export type EntityKind =
  | "sector"
  | "vehicle"
  | "person"
  | "drone"
  | "structure"
  | "signal"
  | "vessel"
  | "uav-hostile";

export type Entity = {
  id: string;
  label: string;
  kind: EntityKind;
  threat: number; // 0..1
  callsign?: string;
  lat?: number;
  lon?: number;
  meta?: Record<string, string | number>;
};

export type Edge = {
  source: string;
  target: string;
  rel: "controls" | "operates" | "communicates" | "transports" | "located-in" | "tracks";
  confidence: number;
};

export type SensorFeed = {
  id: string;
  label: string;
  band: "EO" | "IR" | "SAR" | "RF" | "ACOUSTIC" | "LIDAR";
  sector: string;
  status: "NOMINAL" | "DEGRADED" | "OFFLINE";
  signal: number; // 0..100
  lastTickMs: number;
  detections: number;
};

/** Data lineage — which sensor, band, fusion step and observation time
 *  produced a track. Attached to threat events and propagated into decisions
 *  and tasking so every action is traceable to its source observation. */
export type Provenance = {
  sensorId: string;
  band: string;
  fusionStep?: string;
  observedAt?: string; // ISO timestamp
};

export type ThreatEvent = {
  id: string;
  ts: number; // unix ms (relative to t0)
  entityId: string;
  label: string;
  severity: "INFO" | "WATCH" | "WARN" | "CRITICAL";
  confidence: number;
  predicted: boolean;
  provenance?: Provenance;
};

export type GhostTrack = {
  id: string;
  entityId: string;
  horizonSec: 30 | 60 | 120;
  bearing: number;
  speedKts: number;
  confidence: number;
  ts: number;
};

export type TaskingOrder = {
  id: string;
  ts: number;
  asset: string;
  directive: string;
  status: "DISPATCHED" | "ACK" | "ENROUTE" | "ON-STATION" | "COMPLETE";
  source?: "AI-AUTO" | "OPERATOR" | "MANUAL";
  triggerLevel?: 1 | 2 | 3 | 4 | 5;
  triggerLabel?: string;
  sourceSensor?: string;
  sensorBand?: string;
};

import type { Decision } from "./threat-levels";

export type TelemetryEventMap = {
  "feed:tick": SensorFeed;
  "entity:upsert": Entity;
  "entity:remove": { id: string };
  "edge:upsert": Edge;
  "threat:event": ThreatEvent;
  "ghost-track": GhostTrack;
  "tasking:update": TaskingOrder;
  "system:status": { uplink: number; latencyMs: number; nodes: number; alerts: number };
  "decision:auto": Decision;
  "decision:pending": Decision;
  "decision:resolved": Decision;
};

type Handler<T> = (payload: T) => void;

class TelemetryBus {
  private handlers = new Map<keyof TelemetryEventMap, Set<Handler<unknown>>>();
  on<K extends keyof TelemetryEventMap>(evt: K, fn: Handler<TelemetryEventMap[K]>) {
    if (!this.handlers.has(evt)) this.handlers.set(evt, new Set());
    this.handlers.get(evt)!.add(fn as Handler<unknown>);
    return () => this.off(evt, fn);
  }
  off<K extends keyof TelemetryEventMap>(evt: K, fn: Handler<TelemetryEventMap[K]>) {
    this.handlers.get(evt)?.delete(fn as Handler<unknown>);
  }
  emit<K extends keyof TelemetryEventMap>(evt: K, payload: TelemetryEventMap[K]) {
    this.handlers.get(evt)?.forEach((h) => (h as Handler<TelemetryEventMap[K]>)(payload));
  }
}

// ───────────────────────────── Seed scenario ─────────────────────────────

const sectors = ["ALPHA-7", "BRAVO-2", "CHARLIE-9", "DELTA-1", "ECHO-4"];

const seedEntities: Entity[] = [
  ...sectors.map<Entity>((s) => ({ id: `sector:${s}`, label: `Sector ${s}`, kind: "sector", threat: 0.1 })),
  // Friendly assets
  { id: "uav:VG-01", label: "Vigil-01", callsign: "VG-01", kind: "drone", threat: 0, meta: { fuel: 92, alt: "3500m" } },
  { id: "uav:VG-02", label: "Vigil-02", callsign: "VG-02", kind: "drone", threat: 0, meta: { fuel: 78, alt: "2800m" } },
  { id: "uav:VG-03", label: "Vigil-03", callsign: "VG-03", kind: "drone", threat: 0, meta: { fuel: 64, alt: "4200m" } },
  { id: "uav:VG-04", label: "Vigil-04", callsign: "VG-04", kind: "drone", threat: 0, meta: { fuel: 88, alt: "3100m" } },
  { id: "veh:PATROL-12", label: "Patrol-12", kind: "vehicle", threat: 0, meta: { crew: 4 } },
  { id: "veh:PATROL-17", label: "Patrol-17", kind: "vehicle", threat: 0, meta: { crew: 4 } },
  { id: "struct:OUTPOST-NORTH", label: "Outpost North", kind: "structure", threat: 0 },
  { id: "struct:OUTPOST-SOUTH", label: "Outpost South", kind: "structure", threat: 0 },
  { id: "struct:RELAY-A", label: "Relay A", kind: "structure", threat: 0 },
  // Hostile / unknown
  { id: "trk:GHOST-441", label: "Track 441", kind: "uav-hostile", threat: 0.78, meta: { heading: 187 } },
  { id: "trk:GHOST-442", label: "Track 442", kind: "uav-hostile", threat: 0.55, meta: { heading: 92 } },
  { id: "trk:UNK-118", label: "Unknown 118", kind: "vehicle", threat: 0.41 },
  { id: "trk:UNK-119", label: "Unknown 119", kind: "vehicle", threat: 0.32 },
  { id: "trk:VESSEL-5", label: "Vessel V-5", kind: "vessel", threat: 0.62 },
  { id: "trk:VESSEL-9", label: "Vessel V-9", kind: "vessel", threat: 0.28 },
  { id: "per:CONTACT-A", label: "Contact A", kind: "person", threat: 0.38 },
  { id: "per:CONTACT-B", label: "Contact B", kind: "person", threat: 0.21 },
  { id: "per:CONTACT-C", label: "Contact C", kind: "person", threat: 0.49 },
  { id: "sig:RF-2.4G", label: "RF 2.4GHz Burst", kind: "signal", threat: 0.66 },
  { id: "sig:RF-5.8G", label: "RF 5.8GHz Burst", kind: "signal", threat: 0.44 },
  { id: "sig:ENC-LINK", label: "Encrypted Uplink", kind: "signal", threat: 0.71 },
];

const seedEdges: Edge[] = [
  { source: "uav:VG-01", target: "sector:ALPHA-7", rel: "located-in", confidence: 0.99 },
  { source: "uav:VG-02", target: "sector:BRAVO-2", rel: "located-in", confidence: 0.99 },
  { source: "uav:VG-03", target: "sector:CHARLIE-9", rel: "located-in", confidence: 0.99 },
  { source: "uav:VG-04", target: "sector:DELTA-1", rel: "located-in", confidence: 0.99 },
  { source: "veh:PATROL-12", target: "sector:ALPHA-7", rel: "located-in", confidence: 0.92 },
  { source: "veh:PATROL-17", target: "sector:DELTA-1", rel: "located-in", confidence: 0.94 },
  { source: "struct:OUTPOST-NORTH", target: "sector:ALPHA-7", rel: "located-in", confidence: 1 },
  { source: "struct:OUTPOST-SOUTH", target: "sector:ECHO-4", rel: "located-in", confidence: 1 },
  { source: "struct:RELAY-A", target: "sector:CHARLIE-9", rel: "located-in", confidence: 1 },
  { source: "uav:VG-01", target: "trk:GHOST-441", rel: "tracks", confidence: 0.74 },
  { source: "uav:VG-03", target: "trk:GHOST-442", rel: "tracks", confidence: 0.61 },
  { source: "trk:GHOST-441", target: "sig:RF-2.4G", rel: "communicates", confidence: 0.81 },
  { source: "trk:GHOST-442", target: "sig:RF-5.8G", rel: "communicates", confidence: 0.55 },
  { source: "trk:UNK-118", target: "per:CONTACT-A", rel: "transports", confidence: 0.49 },
  { source: "trk:UNK-119", target: "per:CONTACT-B", rel: "transports", confidence: 0.42 },
  { source: "per:CONTACT-A", target: "sig:ENC-LINK", rel: "operates", confidence: 0.66 },
  { source: "per:CONTACT-C", target: "trk:VESSEL-5", rel: "operates", confidence: 0.71 },
  { source: "trk:VESSEL-5", target: "sector:ECHO-4", rel: "located-in", confidence: 0.85 },
  { source: "trk:VESSEL-9", target: "sector:ECHO-4", rel: "located-in", confidence: 0.72 },
  { source: "trk:UNK-118", target: "sector:BRAVO-2", rel: "located-in", confidence: 0.68 },
  { source: "trk:UNK-119", target: "sector:CHARLIE-9", rel: "located-in", confidence: 0.59 },
  { source: "struct:RELAY-A", target: "sig:ENC-LINK", rel: "communicates", confidence: 0.5 },
  { source: "veh:PATROL-12", target: "trk:UNK-118", rel: "tracks", confidence: 0.55 },
];

const seedFeeds: SensorFeed[] = [
  { id: "feed:EO-N1", label: "EO-N1", band: "EO", sector: "ALPHA-7", status: "NOMINAL", signal: 92, lastTickMs: 0, detections: 14 },
  { id: "feed:IR-N2", label: "IR-N2", band: "IR", sector: "ALPHA-7", status: "NOMINAL", signal: 88, lastTickMs: 0, detections: 9 },
  { id: "feed:SAR-S1", label: "SAR-S1", band: "SAR", sector: "BRAVO-2", status: "NOMINAL", signal: 71, lastTickMs: 0, detections: 22 },
  { id: "feed:RF-C3", label: "RF-C3", band: "RF", sector: "CHARLIE-9", status: "DEGRADED", signal: 54, lastTickMs: 0, detections: 31 },
  { id: "feed:LID-D1", label: "LID-D1", band: "LIDAR", sector: "DELTA-1", status: "NOMINAL", signal: 81, lastTickMs: 0, detections: 7 },
  { id: "feed:ACO-E1", label: "ACO-E1", band: "ACOUSTIC", sector: "ECHO-4", status: "NOMINAL", signal: 67, lastTickMs: 0, detections: 12 },
];

export const scenario = {
  entities: seedEntities,
  edges: seedEdges,
  feeds: seedFeeds,
};

// ───────────────────────────── Singleton + simulator loop ─────────────────────────────

let busInstance: TelemetryBus | null = null;
let simStarted = false;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function startSimulator(bus: TelemetryBus) {
  if (simStarted) return;
  simStarted = true;
  const feeds = seedFeeds.map((f) => ({ ...f }));
  const t0 = Date.now();
  let alerts = 2;

  // Pre-seed predictive timeline (next 8 minutes)
  setTimeout(() => {
    const predictiveSeed: ThreatEvent[] = [];
    const horizonMs = 8 * 60 * 1000;
    const hostiles = seedEntities.filter((e) => e.threat > 0.4);
    for (let i = 0; i < 18; i++) {
      const e = pick(hostiles);
      const sev: ThreatEvent["severity"] = e.threat > 0.65 ? "WARN" : e.threat > 0.5 ? "WATCH" : "INFO";
      predictiveSeed.push({
        id: `thr-pre-${i}`,
        ts: Date.now() + Math.floor(Math.random() * horizonMs),
        entityId: e.id,
        label: `${e.label} predicted ${pick(["incursion", "rendezvous", "loiter", "transit", "comms-burst"])}`,
        severity: sev,
        confidence: rand(0.42, 0.91),
        predicted: true,
      });
    }
    predictiveSeed.forEach((p) => bus.emit("threat:event", p));
  }, 80);

  // Feed ticks
  setInterval(() => {
    const f = pick(feeds);
    f.signal = Math.max(20, Math.min(100, f.signal + rand(-6, 6)));
    f.detections += Math.random() < 0.4 ? 1 : 0;
    f.lastTickMs = Date.now() - t0;
    if (Math.random() < 0.04) f.status = pick(["NOMINAL", "NOMINAL", "DEGRADED"] as const);
    bus.emit("feed:tick", { ...f });
  }, 600);

  // System status
  setInterval(() => {
    bus.emit("system:status", {
      uplink: Math.floor(rand(94, 100)),
      latencyMs: Math.floor(rand(38, 92)),
      nodes: seedEntities.length,
      alerts,
    });
  }, 1200);

  // Live threat events
  setInterval(() => {
    const e = pick(seedEntities.filter((x) => x.threat > 0.3));
    const sev: ThreatEvent["severity"] =
      e.threat > 0.7 ? "CRITICAL" : e.threat > 0.55 ? "WARN" : e.threat > 0.4 ? "WATCH" : "INFO";
    if (sev === "CRITICAL" || sev === "WARN") alerts++;
    bus.emit("threat:event", {
      id: `thr-${Date.now()}-${Math.floor(Math.random() * 999)}`,
      ts: Date.now(),
      entityId: e.id,
      label: `${e.label} ${pick(["movement detected", "signal intercept", "thermal anomaly", "trajectory deviation"])}`,
      severity: sev,
      confidence: rand(0.55, 0.95),
      predicted: false,
    });
  }, 4200);

  // Ghost-track forecasts
  setInterval(() => {
    const e = pick(seedEntities.filter((x) => x.kind === "uav-hostile" || x.kind === "vessel"));
    bus.emit("ghost-track", {
      id: `gt-${Date.now()}`,
      entityId: e.id,
      horizonSec: pick([30, 60, 120] as const),
      bearing: Math.floor(rand(0, 360)),
      speedKts: Math.floor(rand(8, 140)),
      confidence: rand(0.6, 0.94),
      ts: Date.now(),
    });
  }, 3000);
}

export function getBus(): TelemetryBus {
  if (!busInstance) busInstance = new TelemetryBus();
  if (typeof window !== "undefined") startSimulator(busInstance);
  return busInstance;
}

// Tasking dispatch — mimics socket emit with server ack progression
export function dispatchTasking(
  asset: string,
  directive: string,
  meta?: { source?: TaskingOrder["source"]; triggerLevel?: TaskingOrder["triggerLevel"]; triggerLabel?: string },
) {
  const bus = getBus();
  const id = `task-${Date.now()}-${Math.floor(Math.random() * 999)}`;
  const order: TaskingOrder = {
    id,
    ts: Date.now(),
    asset,
    directive,
    status: "DISPATCHED",
    source: meta?.source ?? "MANUAL",
    triggerLevel: meta?.triggerLevel,
    triggerLabel: meta?.triggerLabel,
  };
  bus.emit("tasking:update", order);
  const stages: TaskingOrder["status"][] = ["ACK", "ENROUTE", "ON-STATION", "COMPLETE"];
  stages.forEach((s, i) => {
    setTimeout(() => bus.emit("tasking:update", { ...order, status: s, ts: Date.now() }), (i + 1) * 1500);
  });
  return id;
}
