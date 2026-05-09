import { useEffect, useState } from "react";
import { getBus, type SensorFeed } from "@/lib/telemetry";
import { scenario } from "@/lib/telemetry";

const bandColor: Record<SensorFeed["band"], string> = {
  EO: "text-cyan",
  IR: "text-warning",
  SAR: "text-cyan",
  RF: "text-warning",
  ACOUSTIC: "text-cyan",
  LIDAR: "text-cyan",
};

export function SensorFeeds() {
  const [feeds, setFeeds] = useState<Record<string, SensorFeed>>(() =>
    Object.fromEntries(scenario.feeds.map((f) => [f.id, f])),
  );

  useEffect(() => {
    const bus = getBus();
    return bus.on("feed:tick", (f) => setFeeds((cur) => ({ ...cur, [f.id]: f })));
  }, []);

  const list = Object.values(feeds);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-px bg-border">
      {list.map((f) => (
        <div key={f.id} className="bg-card p-3 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="font-mono text-[10px] tracking-wider text-muted-foreground">
              {f.sector}
            </div>
            <div className={`font-mono text-[10px] flex items-center gap-1.5 ${
              f.status === "NOMINAL" ? "text-cyan" : f.status === "DEGRADED" ? "text-warning" : "text-destructive"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full pulse-dot ${
                f.status === "NOMINAL" ? "bg-cyan" : f.status === "DEGRADED" ? "bg-warning" : "bg-destructive"
              }`} />
              {f.status}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`font-display text-xl font-bold ${bandColor[f.band]}`}>{f.band}</span>
            <span className="font-mono text-xs text-muted-foreground">{f.label}</span>
          </div>
          <div className="mt-3 h-1 bg-secondary overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                f.signal > 70 ? "bg-cyan" : f.signal > 40 ? "bg-warning" : "bg-destructive"
              }`}
              style={{ width: `${f.signal}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>SIG {Math.round(f.signal)}</span>
            <span>DET {f.detections}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
