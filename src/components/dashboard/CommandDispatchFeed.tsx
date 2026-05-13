import { useEffect, useRef, useState } from "react";
import { Radio, Bot, User, Hand } from "lucide-react";
import { getBus, type TaskingOrder } from "@/lib/telemetry";

type FeedRow = TaskingOrder & { history: { status: TaskingOrder["status"]; ts: number }[] };

const STATUS_TONE: Record<TaskingOrder["status"], string> = {
  DISPATCHED: "text-warning border-warning",
  ACK: "text-warning border-warning",
  ENROUTE: "text-cyan border-cyan",
  "ON-STATION": "text-cyan border-cyan",
  COMPLETE: "text-muted-foreground border-border",
};

const SOURCE_META: Record<NonNullable<TaskingOrder["source"]>, { icon: typeof Bot; tone: string; label: string }> = {
  "AI-AUTO": { icon: Bot, tone: "text-cyan", label: "AI" },
  OPERATOR: { icon: User, tone: "text-warning", label: "OPERATOR" },
  MANUAL: { icon: Hand, tone: "text-muted-foreground", label: "MANUAL" },
};

function fmt(ts: number) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

export function CommandDispatchFeed() {
  const [orders, setOrders] = useState<FeedRow[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const off = getBus().on("tasking:update", (o) => {
      setOrders((cur) => {
        const idx = cur.findIndex((x) => x.id === o.id);
        if (idx === -1) {
          return [{ ...o, history: [{ status: o.status, ts: o.ts }] }, ...cur].slice(0, 40);
        }
        const next = [...cur];
        const prev = next[idx];
        next[idx] = {
          ...prev,
          ...o,
          history: [...prev.history, { status: o.status, ts: o.ts }],
        };
        return next;
      });
    });
    return () => off();
  }, []);

  const counts = orders.reduce(
    (a, o) => {
      a.total++;
      if (o.status === "COMPLETE") a.complete++;
      else a.active++;
      return a;
    },
    { total: 0, active: 0, complete: 0 },
  );

  return (
    <div className="bg-card flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Radio className="w-3 h-3 text-cyan pulse-dot" />
          Command Dispatch · Live
        </div>
        <div className="flex items-center gap-2 font-mono text-[9px]">
          <span className="text-cyan">{counts.active} ACTIVE</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{counts.complete} DONE</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {orders.length === 0 && (
          <div className="text-xs text-muted-foreground font-mono px-1 py-6 text-center opacity-60">
            Awaiting dispatch. Orders appear here in real time after each AI or human decision.
          </div>
        )}

        {orders.map((o) => {
          const src = SOURCE_META[o.source ?? "MANUAL"];
          const SrcIcon = src.icon;
          const stages: TaskingOrder["status"][] = ["DISPATCHED", "ACK", "ENROUTE", "ON-STATION", "COMPLETE"];
          const reachedIdx = stages.indexOf(o.status);
          return (
            <div
              key={o.id}
              className={`border ${STATUS_TONE[o.status]} bg-background/40 px-2.5 py-2 space-y-1.5`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <SrcIcon className={`w-3 h-3 shrink-0 ${src.tone}`} />
                  <span className={`font-mono text-[9px] uppercase tracking-wider ${src.tone}`}>
                    {src.label}
                  </span>
                  {o.triggerLevel && (
                    <span className="font-mono text-[9px] px-1 border border-border text-muted-foreground">
                      L{o.triggerLevel}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-foreground truncate">
                    {o.asset}
                  </span>
                </div>
                <span className={`font-mono text-[9px] px-1.5 py-px border ${STATUS_TONE[o.status]}`}>
                  {o.status}
                </span>
              </div>

              <div className="font-mono text-[10px] text-foreground leading-snug truncate">
                ▸ {o.directive}
              </div>

              {o.triggerLabel && (
                <div className="font-mono text-[9px] text-muted-foreground truncate">
                  trigger · {o.triggerLabel}
                </div>
              )}

              {/* Stage progress */}
              <div className="flex items-center gap-0.5 pt-0.5">
                {stages.map((s, i) => (
                  <div
                    key={s}
                    className={`h-0.5 flex-1 ${
                      i <= reachedIdx
                        ? o.status === "COMPLETE"
                          ? "bg-cyan/60"
                          : "bg-cyan"
                        : "bg-border"
                    }`}
                    title={s}
                  />
                ))}
                <span className="font-mono text-[8px] text-muted-foreground tabular-nums ml-1.5">
                  {fmt(o.ts)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
