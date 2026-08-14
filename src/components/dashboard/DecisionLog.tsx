import { useEffect, useState } from "react";
import { getBus } from "@/lib/telemetry";
import { LEVEL_META, type Decision } from "@/lib/threat-levels";

type Entry = Decision & { kind: "AUTO" | "RESOLVED" };

export function DecisionLog() {
  const [log, setLog] = useState<Entry[]>([]);

  useEffect(() => {
    const bus = getBus();
    const a = bus.on("decision:auto", (d) =>
      setLog((l) => [{ ...d, kind: "AUTO" as const }, ...l].slice(0, 60)),
    );
    const r = bus.on("decision:resolved", (d) =>
      setLog((l) => [{ ...d, kind: "RESOLVED" as const }, ...l].slice(0, 60)),
    );
    return () => { a(); r(); };
  }, []);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-4 py-2 border-b border-border font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
        <span className="w-1 h-1 bg-cyan rounded-full pulse-dot" />
        Decision Log · AI + Operator
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {log.length === 0 && (
          <div className="text-[11px] text-muted-foreground font-mono px-1 py-3 opacity-60">
            Awaiting decisions…
          </div>
        )}
        {log.map((e, i) => {
          const m = LEVEL_META[e.level];
          const ts = new Date(e.resolvedTs ?? e.ts).toISOString().substring(11, 19);
          const statusColor =
            e.status === "REJECTED" ? "text-destructive" :
            e.status === "TIMEOUT" ? "text-warning" :
            e.status === "AUTO-EXECUTED" ? "text-cyan" :
            "text-cyan";
          return (
            <div key={`${e.id}-${i}`} className={`border-l-2 ${m.border} pl-2 py-1`}>
              <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <span className={m.tone}>{m.code}</span>
                  <span className="text-muted-foreground tabular-nums">{ts}</span>
                </div>
                <span className={statusColor}>{e.status}</span>
              </div>
              <div className="font-mono text-[10px] text-foreground/90 leading-snug truncate">
                {e.modifiedAction ?? e.action}
              </div>
              {e.provenance && (
                <div className="font-mono text-[8px] text-cyan/70 truncate" title={`${e.provenance.sensorId} · ${e.provenance.band} · ${e.provenance.fusionStep}`}>
                  {e.provenance.sensorId} · {e.provenance.band} · {e.provenance.fusionStep}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
