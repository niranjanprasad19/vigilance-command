const items = [
  "SECTOR WEST-9 NOMINAL",
  "DRONE SWARM ALPHA · 12 ASSETS AIRBORNE",
  "VANGUARD AI · MODEL v4.2 SYNCED",
  "THERMAL ANOMALY · GRID 47.2N RESOLVED",
  "PERIMETER INTEGRITY · 100%",
  "TELEMETRY BUS · 1.24M EVT/S",
  "ONTOLOGY · 8,492,113 ENTITIES",
];

export function Ticker() {
  const row = [...items, ...items];
  return (
    <div className="relative border-y border-border bg-background overflow-hidden py-3">
      <div className="ticker flex gap-12 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 bg-cyan rounded-full" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
