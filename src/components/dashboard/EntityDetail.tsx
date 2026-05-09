import type { Entity } from "@/lib/telemetry";
import { scenario } from "@/lib/telemetry";

export function EntityDetail({ entity }: { entity: Entity | null }) {
  if (!entity) {
    return (
      <div className="p-4 text-xs text-muted-foreground font-mono">
        Select an entity in the Nexus Graph to inspect relationships.
      </div>
    );
  }
  const edges = scenario.edges.filter((e) => e.source === entity.id || e.target === entity.id);
  const threatPct = Math.round((entity.threat ?? 0) * 100);
  const threatColor = threatPct > 60 ? "text-destructive" : threatPct > 35 ? "text-warning" : "text-cyan";

  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {entity.kind.toUpperCase()}
        </div>
        <div className="font-display text-2xl font-bold mt-1">{entity.label}</div>
        <div className="font-mono text-[10px] text-muted-foreground mt-1">{entity.id}</div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border">
        <div className="bg-background p-3">
          <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">Threat</div>
          <div className={`font-display text-xl font-bold ${threatColor}`}>{threatPct}%</div>
        </div>
        <div className="bg-background p-3">
          <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">Edges</div>
          <div className="font-display text-xl font-bold text-cyan">{edges.length}</div>
        </div>
      </div>

      {entity.meta && (
        <div className="space-y-1">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Attributes</div>
          {Object.entries(entity.meta).map(([k, v]) => (
            <div key={k} className="flex justify-between font-mono text-[11px]">
              <span className="text-muted-foreground">{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Relationships ({edges.length})
        </div>
        <div className="max-h-40 overflow-y-auto space-y-1">
          {edges.map((e, i) => {
            const otherId = e.source === entity.id ? e.target : e.source;
            const other = scenario.entities.find((x) => x.id === otherId);
            return (
              <div key={i} className="flex justify-between font-mono text-[11px] border-l-2 border-border pl-2">
                <span>
                  <span className="text-cyan">{e.rel}</span> → {other?.label ?? otherId}
                </span>
                <span className="text-muted-foreground">{(e.confidence * 100).toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
