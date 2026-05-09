import { useEffect, useMemo, useRef, useState } from "react";
import { getBus, type ThreatEvent } from "@/lib/telemetry";

const sevColor: Record<ThreatEvent["severity"], string> = {
  INFO: "#5fd1ff",
  WATCH: "#a4d8ff",
  WARN: "#ffb86b",
  CRITICAL: "#ff4d5e",
};

export function ChronosTimeline() {
  const [events, setEvents] = useState<ThreatEvent[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(900);

  useEffect(() => {
    const bus = getBus();
    return bus.on("threat:event", (e) => {
      setEvents((cur) => [...cur.slice(-200), e]);
    });
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.getBoundingClientRect().width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { items, range, now } = useMemo(() => {
    const nowTs = Date.now();
    const past = 4 * 60 * 1000; // 4 min back
    const future = 8 * 60 * 1000; // 8 min forward
    const minTs = nowTs - past;
    const maxTs = nowTs + future;
    return {
      items: events.filter((e) => e.ts >= minTs && e.ts <= maxTs),
      range: { min: minTs, max: maxTs },
      now: nowTs,
    };
  }, [events]);

  const xFor = (ts: number) => ((ts - range.min) / (range.max - range.min)) * (w - 32) + 16;
  const trackY = (sev: ThreatEvent["severity"]) =>
    sev === "CRITICAL" ? 28 : sev === "WARN" ? 56 : sev === "WATCH" ? 84 : 112;

  // tick marks every minute
  const ticks: number[] = [];
  const startMin = Math.ceil(range.min / 60000) * 60000;
  for (let t = startMin; t < range.max; t += 60000) ticks.push(t);

  const activeAlerts = items.filter((e) => !e.predicted && (e.severity === "WARN" || e.severity === "CRITICAL"));

  return (
    <div className="bg-card border-t border-border">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Chronos · Predictive Timeline · T−4m → T+8m
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px]">
          <span className="text-cyan flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-cyan rounded-full" /> live
          </span>
          <span className="text-warning flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-warning rounded-full" /> predicted
          </span>
          <span className="text-destructive flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-destructive rounded-full pulse-dot" />
            {activeAlerts.length} active alert{activeAlerts.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <div ref={wrapRef} className="relative h-36">
        <svg width={w} height={144} className="block">
          {/* track lanes */}
          {(["CRITICAL", "WARN", "WATCH", "INFO"] as const).map((s) => (
            <g key={s}>
              <line x1={16} x2={w - 16} y1={trackY(s)} y2={trackY(s)} stroke="oklch(0.24 0.013 240)" strokeWidth={1} />
              <text x={4} y={trackY(s) + 3} fontSize={8} fill="#5d6b7a" fontFamily="JetBrains Mono">
                {s.slice(0, 3)}
              </text>
            </g>
          ))}
          {/* minute ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={xFor(t)} x2={xFor(t)} y1={8} y2={136} stroke="oklch(0.20 0.013 240)" strokeWidth={1} />
              <text x={xFor(t) + 3} y={14} fontSize={8} fill="#5d6b7a" fontFamily="JetBrains Mono">
                {new Date(t).toISOString().substring(14, 19)}
              </text>
            </g>
          ))}
          {/* now line */}
          <line x1={xFor(now)} x2={xFor(now)} y1={6} y2={138} stroke="#3ee2ff" strokeWidth={1.5} strokeDasharray="2 3" />
          <text x={xFor(now) + 4} y={140} fontSize={9} fill="#3ee2ff" fontFamily="JetBrains Mono">
            NOW
          </text>
          {/* events */}
          {items.map((e) => {
            const cx = xFor(e.ts);
            const cy = trackY(e.severity);
            const r = e.severity === "CRITICAL" ? 5 : e.severity === "WARN" ? 4 : 3;
            return (
              <g key={e.id}>
                {!e.predicted && (e.severity === "WARN" || e.severity === "CRITICAL") && (
                  <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke={sevColor[e.severity]} strokeOpacity={0.3} />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={sevColor[e.severity]}
                  fillOpacity={e.predicted ? 0.45 : 1}
                  stroke={e.predicted ? sevColor[e.severity] : "none"}
                  strokeDasharray={e.predicted ? "1 1.5" : "0"}
                />
                <title>
                  {`[${e.severity}] ${e.label}\nconf ${(e.confidence * 100).toFixed(0)}% · ${e.predicted ? "predicted" : "live"}`}
                </title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
