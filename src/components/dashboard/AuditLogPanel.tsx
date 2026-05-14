import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, ShieldAlert, Download, FlaskConical } from "lucide-react";
import {
  exportAuditJson,
  getAuditLog,
  subscribeAudit,
  tamperWithLogForDemo,
  verifyChain,
  type AuditEntry,
  type ChainVerdict,
} from "@/lib/audit-log";
import { useOps } from "@/lib/ops-context";

const KIND_TONE: Record<AuditEntry["kind"], string> = {
  DECISION_AUTO:     "text-cyan",
  DECISION_PENDING:  "text-warning",
  DECISION_RESOLVED: "text-cyan",
  TASKING_DISPATCH:  "text-cyan",
  ROLE_CHANGE:       "text-muted-foreground",
  MODE_CHANGE:       "text-warning",
  DEGRADED_TOGGLE:   "text-warning",
  INJECT_SCENARIO:   "text-muted-foreground",
};

export function AuditLogPanel() {
  const { can } = useOps();
  const [, force] = useState(0);
  const [verdict, setVerdict] = useState<ChainVerdict | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => subscribeAudit(() => force((x) => x + 1)), []);
  useEffect(() => {
    const i = setInterval(() => setVerdict(verifyChain()), 2000);
    setVerdict(verifyChain());
    return () => clearInterval(i);
  }, []);

  const log = useMemo(() => {
    const all = getAuditLog().slice().reverse();
    if (!filter) return all;
    const f = filter.toLowerCase();
    return all.filter((e) =>
      e.kind.toLowerCase().includes(f) ||
      e.actor.toLowerCase().includes(f) ||
      JSON.stringify(e.payload).toLowerCase().includes(f),
    );
  }, [filter, /* re-render on force */ getAuditLog().length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = () => {
    const blob = new Blob([exportAuditJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vigilance-audit-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ok = verdict?.ok ?? true;

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {ok
            ? <ShieldCheck className="w-3 h-3 text-cyan" />
            : <ShieldAlert className="w-3 h-3 text-destructive pulse-dot" />}
          Audit Chain · cyrb53
        </div>
        <div className={`font-mono text-[10px] px-1.5 py-0.5 border ${
          ok ? "border-cyan/50 text-cyan" : "border-destructive text-destructive pulse-dot"
        }`}>
          {ok ? `VERIFIED · ${verdict?.total ?? 0}` : `BROKEN @ #${verdict?.brokenAt}`}
        </div>
      </div>

      <div className="px-3 py-2 border-b border-border flex flex-wrap items-center gap-1.5">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter…"
          className="flex-1 min-w-[120px] bg-background border border-border px-2 py-1 font-mono text-[10px] outline-none focus:border-cyan"
        />
        {can("audit.export") && (
          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-2 py-1 border border-cyan/60 text-cyan hover:bg-cyan/10 font-mono text-[10px] uppercase tracking-wider"
          >
            <Download className="w-3 h-3" /> Export
          </button>
        )}
        <button
          onClick={() => {
            const all = getAuditLog();
            if (all.length > 0) tamperWithLogForDemo(all[Math.floor(all.length / 2)].seq);
            setVerdict(verifyChain());
          }}
          title="Demo: silently mutate a middle entry — chain verification will detect it."
          className="flex items-center gap-1 px-2 py-1 border border-warning/60 text-warning hover:bg-warning/10 font-mono text-[10px] uppercase tracking-wider"
        >
          <FlaskConical className="w-3 h-3" /> Tamper
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 font-mono text-[10px]">
        {log.length === 0 && (
          <div className="text-muted-foreground px-2 py-3 opacity-60">
            No audit entries yet. Trigger a decision to populate the chain.
          </div>
        )}
        {log.map((e) => {
          const ts = new Date(e.ts).toISOString().substring(11, 19);
          const tampered = (e.payload as Record<string, unknown>).__tampered;
          return (
            <div
              key={e.seq}
              className={`border-l-2 pl-2 py-1 ${
                tampered ? "border-destructive bg-destructive/10" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground tabular-nums">#{e.seq}</span>
                  <span className="text-muted-foreground tabular-nums">{ts}</span>
                  <span className={KIND_TONE[e.kind]}>{e.kind}</span>
                  <span className={`px-1 py-px border text-[8px] uppercase ${
                    e.mode === "LIVE" ? "border-destructive text-destructive" : "border-cyan/40 text-cyan"
                  }`}>{e.mode}</span>
                </div>
                <span className="text-muted-foreground text-[9px] truncate max-w-[80px]" title={e.hash}>
                  {e.hash.slice(0, 8)}…
                </span>
              </div>
              <div className="text-foreground/80 truncate" title={JSON.stringify(e.payload)}>
                {e.actor} · {summarize(e)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function summarize(e: AuditEntry): string {
  const p = e.payload as Record<string, unknown>;
  switch (e.kind) {
    case "DECISION_AUTO":
    case "DECISION_PENDING":
      return `L${p.level} · ${String(p.action ?? "")}`;
    case "DECISION_RESOLVED":
      return `L${p.level} · ${String(p.status)} · ${String(p.action ?? "")}`;
    case "TASKING_DISPATCH":
      return `${String(p.asset)} ← ${String(p.directive)}`;
    case "ROLE_CHANGE":
      return `${String(p.from)} → ${String(p.to)}`;
    case "MODE_CHANGE":
      return `${String(p.from)} → ${String(p.to)}`;
    case "DEGRADED_TOGGLE":
      return `${String(p.mode)} ${p.on ? "ON" : "OFF"}`;
    default:
      return JSON.stringify(p).slice(0, 80);
  }
}
