import { useState } from "react";
import { Beaker, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { injectScenario, type ScenarioKey } from "@/lib/decision-engine";
import { useOps } from "@/lib/ops-context";
import { appendAudit } from "@/lib/audit-log";

const SCENARIOS: { key: ScenarioKey; label: string; level: string; tone: string }[] = [
  { key: "rf", label: "RF Anomaly", level: "L2", tone: "border-cyan/60 text-cyan" },
  { key: "incursion", label: "Vehicle Tripwire", level: "L3", tone: "border-cyan text-cyan" },
  { key: "drone", label: "Drone Incursion", level: "L4", tone: "border-warning text-warning" },
  { key: "vessel", label: "Vessel Intrusion", level: "L5", tone: "border-destructive text-destructive" },
];

export function DemoInjector() {
  const [open, setOpen] = useState(true);
  const { can } = useOps();
  const allowed = can("ops.inject_scenario");

  return (
    <div className="fixed bottom-4 right-4 z-40 bg-card/95 backdrop-blur-md border border-border shadow-2xl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border-b border-border font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-cyan transition"
      >
        <span className="flex items-center gap-1.5">
          <Beaker className="w-3 h-3 text-cyan" />
          Demo · Inject Scenario
        </span>
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>
      {open && (
        <div className="p-2 grid grid-cols-2 gap-1.5 w-64">
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              disabled={!allowed}
              onClick={() => {
                appendAudit("INJECT_SCENARIO", { key: s.key, level: s.level });
                injectScenario(s.key);
              }}
              className={`px-2 py-2 border ${s.tone} hover:bg-current/10 transition text-left disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <div className="font-mono text-[9px] opacity-70 flex items-center gap-1">
                {!allowed && <Lock className="w-2.5 h-2.5" />}
                {s.level}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-wider">{s.label}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
