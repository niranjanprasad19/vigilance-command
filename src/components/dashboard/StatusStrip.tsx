import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getBus } from "@/lib/telemetry";
import { Activity, Radio, Zap, AlertTriangle, CloudOff } from "lucide-react";
import { subscribeOutbox, type OutboxSnapshot } from "@/lib/outbox";

type Sys = { uplink: number; latencyMs: number; nodes: number; alerts: number };

export function StatusStrip() {
  const [s, setS] = useState<Sys>({ uplink: 99, latencyMs: 42, nodes: 0, alerts: 0 });
  const [time, setTime] = useState(() => new Date().toISOString().substring(11, 19));
  const latHistory = useRef<number[]>([]);
  const [tick, setTick] = useState(0);
  const [outbox, setOutbox] = useState<OutboxSnapshot | null>(null);

  useEffect(() => {
    const bus = getBus();
    const off = bus.on("system:status", (next) => {
      latHistory.current = [...latHistory.current.slice(-39), next.latencyMs];
      setS(next);
      setTick((x) => x + 1);
    });
    const i = setInterval(() => setTime(new Date().toISOString().substring(11, 19)), 1000);
    const offOutbox = subscribeOutbox(setOutbox);
    return () => {
      off();
      clearInterval(i);
      offOutbox();
    };
  }, []);

  const condition = s.alerts > 4 ? "REDCON-1" : s.alerts > 1 ? "WATCHCON" : "STEADY";
  const condColor =
    condition === "REDCON-1" ? "text-destructive border-destructive" : condition === "WATCHCON" ? "text-warning border-warning" : "text-cyan border-cyan/40";

  const outboxQueued = (outbox?.pending ?? 0) > 0;
  const outboxOffline = outbox != null && !outbox.online;

  return (
    <header className="relative border-b border-border bg-card/90 backdrop-blur-md">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan/50 to-transparent" />
      <div className="flex items-center justify-between px-3 md:px-5 py-2.5 gap-4">
        <div className="flex items-center gap-3 md:gap-6 min-w-0">
          <Link to="/" className="font-display text-base md:text-lg font-bold tracking-tight whitespace-nowrap">
            VIGILANCE<span className="text-cyan text-glow-cyan">.</span>
          </Link>
          <div className={`hidden md:flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] border px-2 py-0.5 ${condColor}`}>
            <span className="w-1.5 h-1.5 bg-current rounded-full pulse-dot" />
            {condition}
          </div>
          <div className="hidden lg:block font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground truncate">
            Command Console · UTC {time}
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-5 font-mono text-[10px]">
          {outboxQueued && (
            <div
              className={`flex items-center gap-1.5 px-2 py-1 border ${
                outboxOffline ? "border-destructive text-destructive" : "border-warning text-warning"
              } ${outboxOffline ? "pulse-dot" : ""}`}
              title={outboxOffline ? "Comms loss — outbox holding, will drain on restore" : `Outbox reconciling — ${outbox?.pending} queued`}
            >
              <CloudOff className="w-3 h-3" />
              <span className="uppercase tracking-wider text-[9px]">OUTBOX</span>
              <span className="tabular-nums">{outbox?.pending}</span>
            </div>
          )}
          <UplinkBars value={s.uplink} />
          <LatencyChip value={s.latencyMs} history={latHistory.current} />
          <Stat icon={<Radio className="w-3 h-3" />} label="NODES" value={s.nodes} tone="ok" />
          <AlertChip count={s.alerts} key={tick} />
        </div>
      </div>
    </header>
  );
}

function UplinkBars({ value }: { value: number }) {
  const bars = 5;
  const active = Math.round((value / 100) * bars);
  return (
    <div className="flex items-center gap-1.5">
      <Zap className="w-3 h-3 text-cyan" />
      <div className="hidden sm:flex items-end gap-0.5 h-3.5">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className={`w-0.5 transition-all ${i < active ? "bg-cyan" : "bg-border"}`}
            style={{ height: `${(i + 1) * 22}%` }}
          />
        ))}
      </div>
      <span className="text-cyan tabular-nums w-9 text-right">{value}%</span>
    </div>
  );
}

function LatencyChip({ value, history }: { value: number; history: number[] }) {
  const ok = value < 80;
  const max = Math.max(120, ...history);
  return (
    <div className="hidden sm:flex items-center gap-1.5">
      <Activity className={`w-3 h-3 ${ok ? "text-cyan" : "text-warning"}`} />
      <svg width={48} height={14} className="overflow-visible">
        <polyline
          fill="none"
          stroke={ok ? "var(--cyan)" : "var(--warning)"}
          strokeWidth={1}
          points={history.map((v, i) => `${(i / Math.max(1, history.length - 1)) * 48},${14 - (v / max) * 14}`).join(" ")}
        />
      </svg>
      <span className={`tabular-nums w-12 text-right ${ok ? "text-cyan" : "text-warning"}`}>{value}ms</span>
    </div>
  );
}

function AlertChip({ count }: { count: number }) {
  const hot = count > 0;
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 border ${
        hot ? "border-destructive text-destructive" : "border-border text-muted-foreground"
      }`}
    >
      <AlertTriangle className={`w-3 h-3 ${hot ? "pulse-dot" : ""}`} />
      <span className="uppercase tracking-wider text-[9px]">Alerts</span>
      <span className="tabular-nums">{count}</span>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "ok" | "warn" }) {
  const color = tone === "warn" ? "text-warning" : "text-cyan";
  return (
    <div className="hidden md:flex items-center gap-1.5">
      <span className={color}>{icon}</span>
      <span className="text-muted-foreground uppercase tracking-wider text-[9px]">{label}</span>
      <span className={`${color} tabular-nums`}>{value}</span>
    </div>
  );
}
