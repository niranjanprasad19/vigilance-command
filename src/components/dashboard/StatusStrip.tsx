import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getBus } from "@/lib/telemetry";

export function StatusStrip() {
  const [s, setS] = useState({ uplink: 99, latencyMs: 42, nodes: 0, alerts: 0 });
  const [time, setTime] = useState(() => new Date().toISOString().substring(11, 19));

  useEffect(() => {
    const bus = getBus();
    const off = bus.on("system:status", setS);
    const i = setInterval(() => setTime(new Date().toISOString().substring(11, 19)), 1000);
    return () => {
      off();
      clearInterval(i);
    };
  }, []);

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-display text-base font-bold tracking-tight">
            VIGILANCE<span className="text-cyan">.</span>
          </Link>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Command Console · UTC {time}
          </div>
        </div>
        <div className="flex items-center gap-5 font-mono text-[10px]">
          <Stat label="UPLINK" value={`${s.uplink}%`} good={s.uplink > 95} />
          <Stat label="LAT" value={`${s.latencyMs}ms`} good={s.latencyMs < 80} />
          <Stat label="NODES" value={s.nodes} good />
          <Stat label="ALERTS" value={s.alerts} good={false} accent={s.alerts > 0 ? "warn" : "ok"} />
        </div>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  good,
  accent,
}: {
  label: string;
  value: string | number;
  good?: boolean;
  accent?: "warn" | "ok";
}) {
  const color = accent === "warn" ? "text-destructive" : good ? "text-cyan" : "text-warning";
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={color}>{value}</span>
    </div>
  );
}
