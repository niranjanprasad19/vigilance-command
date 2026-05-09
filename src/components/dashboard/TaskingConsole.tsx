import { useEffect, useState } from "react";
import { dispatchTasking, getBus, type GhostTrack, type TaskingOrder } from "@/lib/telemetry";

const ASSETS = ["VG-01", "VG-02", "VG-03", "VG-04", "Patrol-12", "Patrol-17"];
const DIRECTIVES = [
  "Shadow & report",
  "Establish overwatch",
  "Intercept & illuminate",
  "Deny corridor",
  "Recon pass",
];

export function TaskingConsole() {
  const [asset, setAsset] = useState(ASSETS[0]);
  const [directive, setDirective] = useState(DIRECTIVES[0]);
  const [orders, setOrders] = useState<TaskingOrder[]>([]);
  const [tracks, setTracks] = useState<GhostTrack[]>([]);

  useEffect(() => {
    const bus = getBus();
    const offT = bus.on("tasking:update", (o) => {
      setOrders((cur) => {
        const idx = cur.findIndex((x) => x.id === o.id);
        if (idx === -1) return [o, ...cur].slice(0, 8);
        const next = [...cur];
        next[idx] = o;
        return next;
      });
    });
    const offG = bus.on("ghost-track", (g) => setTracks((cur) => [g, ...cur].slice(0, 6)));
    return () => {
      offT();
      offG();
    };
  }, []);

  return (
    <div className="bg-card flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Tasking · Ghost-Track Forecasts
      </div>

      {/* Ghost-tracks */}
      <div className="px-4 py-3 border-b border-border">
        <div className="font-mono text-[10px] text-muted-foreground mb-2">PREDICTED TRAJECTORIES</div>
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {tracks.length === 0 && <div className="text-xs text-muted-foreground">No active forecasts.</div>}
          {tracks.map((t) => (
            <div key={t.id} className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-cyan">{t.entityId.split(":")[1]}</span>
              <span className="text-muted-foreground">+{t.horizonSec}s</span>
              <span>{t.bearing}°</span>
              <span>{t.speedKts}kt</span>
              <span className="text-warning">{(t.confidence * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dispatch */}
      <div className="px-4 py-3 border-b border-border space-y-2">
        <div className="font-mono text-[10px] text-muted-foreground">DISPATCH ORDER</div>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="bg-background border border-border px-2 py-1.5 font-mono text-xs outline-none focus:border-cyan"
          >
            {ASSETS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select
            value={directive}
            onChange={(e) => setDirective(e.target.value)}
            className="bg-background border border-border px-2 py-1.5 font-mono text-xs outline-none focus:border-cyan"
          >
            {DIRECTIVES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => dispatchTasking(asset, directive)}
          className="w-full font-mono text-[11px] uppercase tracking-[0.2em] py-2 border border-cyan text-cyan hover:bg-cyan hover:text-primary-foreground transition"
        >
          ▸ Dispatch
        </button>
      </div>

      {/* Order log */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="font-mono text-[10px] text-muted-foreground mb-2">ORDER LOG</div>
        <div className="space-y-1.5">
          {orders.length === 0 && <div className="text-xs text-muted-foreground">No orders dispatched.</div>}
          {orders.map((o) => (
            <div key={o.id + o.status} className="flex items-center justify-between font-mono text-[10px] border-l-2 border-cyan pl-2">
              <span>
                {o.asset} <span className="text-muted-foreground">·</span> {o.directive}
              </span>
              <span
                className={
                  o.status === "COMPLETE"
                    ? "text-cyan"
                    : o.status === "ON-STATION"
                      ? "text-cyan"
                      : "text-warning"
                }
              >
                {o.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
