import { useEffect, useState } from "react";
import { getBus } from "@/lib/telemetry";
import { LEVEL_META, type Decision, type ThreatLevel } from "@/lib/threat-levels";

const LEVELS: ThreatLevel[] = [1, 2, 3, 4, 5];

export function ThreatLevelStrip() {
  const [counts, setCounts] = useState<Record<ThreatLevel, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [pulse, setPulse] = useState<ThreatLevel | null>(null);

  useEffect(() => {
    const bus = getBus();
    const tally = (d: Decision) => {
      setCounts((c) => ({ ...c, [d.level]: c[d.level] + 1 }));
      setPulse(d.level);
      setTimeout(() => setPulse(null), 700);
    };
    const a = bus.on("decision:auto", tally);
    const b = bus.on("decision:pending", tally);
    return () => { a(); b(); };
  }, []);

  return (
    <div className="border-b border-border bg-card/60 backdrop-blur-sm">
      <div className="flex items-stretch divide-x divide-border">
        <div className="px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground flex items-center whitespace-nowrap">
          Threat Triage
        </div>
        {LEVELS.map((l) => {
          const m = LEVEL_META[l];
          const isHuman = l >= 4;
          const flashing = pulse === l;
          return (
            <div
              key={l}
              className={`flex-1 px-3 py-1.5 flex items-center justify-between gap-3 transition-colors ${
                flashing ? m.bg : ""
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`font-mono text-[10px] font-bold ${m.tone}`}>{m.code}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                  {m.name}
                </span>
                <span
                  className={`hidden md:inline font-mono text-[8px] uppercase tracking-wider px-1 py-px border ${
                    isHuman ? "border-warning/60 text-warning" : "border-cyan/40 text-cyan"
                  }`}
                >
                  {isHuman ? "HUMAN" : "AI-AUTO"}
                </span>
              </div>
              <span className={`font-display text-base font-bold tabular-nums ${m.tone}`}>{counts[l]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
