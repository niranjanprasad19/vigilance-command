import { useEffect, useRef, useState } from "react";
import { Check, Edit3, X, Shield, Clock, Lock } from "lucide-react";
import { getBus } from "@/lib/telemetry";
import { resolveDecision } from "@/lib/decision-engine";
import { LEVEL_META, type Decision } from "@/lib/threat-levels";
import { useOps } from "@/lib/ops-context";
import { ROLE_META } from "@/lib/rbac";

export function ApprovalQueue() {
  const ops = useOps();
  const [queue, setQueue] = useState<Decision[]>([]);
  const [now, setNow] = useState(Date.now());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmL5, setConfirmL5] = useState<Set<string>>(new Set());
  const tRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const bus = getBus();
    const offP = bus.on("decision:pending", (d) => setQueue((q) => [d, ...q]));
    const offR = bus.on("decision:resolved", (d) =>
      setQueue((q) => q.filter((x) => x.id !== d.id)),
    );
    tRef.current = setInterval(() => setNow(Date.now()), 500);
    return () => {
      offP();
      offR();
      if (tRef.current) clearInterval(tRef.current);
    };
  }, []);

  const handleApprove = (d: Decision) => {
    if (!ops.canActOn(d, "approve").allowed) return;
    if (d.level === 5 && !confirmL5.has(d.id)) {
      setConfirmL5((s) => new Set(s).add(d.id));
      return;
    }
    resolveDecision(d.id, "APPROVED");
  };
  const handleModify = (d: Decision) => {
    if (!ops.canActOn(d, "modify").allowed) return;
    if (editingId === d.id) {
      resolveDecision(d.id, "MODIFIED", editValue.trim() || d.action);
      setEditingId(null);
    } else {
      setEditingId(d.id);
      setEditValue(d.action);
    }
  };
  const handleReject = (d: Decision) => {
    if (!ops.canActOn(d, "reject").allowed) return;
    resolveDecision(d.id, "REJECTED");
  };

  return (
    <div className="bg-card flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Shield className="w-3 h-3 text-warning" />
          Approval Queue · Human-in-the-Loop
        </div>
        <span
          className={`font-mono text-[10px] px-1.5 py-0.5 border ${
            queue.length > 0 ? "border-warning text-warning pulse-dot" : "border-cyan/40 text-cyan"
          }`}
        >
          {queue.length > 0 ? `${queue.length} PENDING` : "ALL CLEAR"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {queue.length === 0 && (
          <div className="text-xs text-muted-foreground font-mono px-1 py-6 text-center opacity-60">
            No human-required decisions. AI handling all traffic L1–L3 autonomously.
          </div>
        )}

        {queue.map((d) => {
          const m = LEVEL_META[d.level];
          const elapsed = (now - d.ts) / 1000;
          const remain = Math.max(0, 30 - elapsed);
          const remainPct = (remain / 30) * 100;
          const dual = d.level === 5;
          const awaitingDual = dual && confirmL5.has(d.id);

          return (
            <div
              key={d.id}
              className={`border ${m.border} ${m.bg} relative overflow-hidden`}
            >
              {/* timeout bar */}
              <div
                className="absolute top-0 left-0 h-0.5 bg-current opacity-60 transition-all"
                style={{ width: `${remainPct}%` }}
              />
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[10px] font-bold ${m.tone}`}>
                      {m.code} · {m.name}
                    </span>
                    {dual && (
                      <span className="font-mono text-[8px] uppercase tracking-wider px-1 py-px border border-destructive text-destructive">
                        DUAL-CONFIRM
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                    <Clock className="w-2.5 h-2.5" />
                    <span className="tabular-nums">{remain.toFixed(0)}s</span>
                  </div>
                </div>

                <div className="font-display text-sm font-semibold leading-tight">
                  {d.event.label}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {d.entity?.label ?? d.event.entityId}
                </div>

                <div className="border-l-2 border-cyan/60 pl-2 py-1 space-y-1">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-cyan">
                    AI Recommendation
                  </div>
                  {editingId === d.id ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full bg-background border border-cyan px-2 py-1 font-mono text-[11px] outline-none"
                    />
                  ) : (
                    <div className="font-mono text-[11px] text-foreground">{d.action}</div>
                  )}
                  <div className="font-mono text-[9px] text-muted-foreground">{d.rationale}</div>
                </div>

                {awaitingDual && (
                  <div className="font-mono text-[10px] text-destructive border border-destructive px-2 py-1 pulse-dot">
                    ⚠ Click APPROVE again to confirm L5 command authority.
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    onClick={() => handleApprove(d)}
                    className="flex items-center justify-center gap-1 py-1.5 border border-cyan text-cyan hover:bg-cyan hover:text-primary-foreground transition font-mono text-[10px] uppercase tracking-wider"
                  >
                    <Check className="w-3 h-3" />
                    {awaitingDual ? "Confirm" : "Approve"}
                  </button>
                  <button
                    onClick={() => handleModify(d)}
                    className="flex items-center justify-center gap-1 py-1.5 border border-warning text-warning hover:bg-warning hover:text-primary-foreground transition font-mono text-[10px] uppercase tracking-wider"
                  >
                    <Edit3 className="w-3 h-3" />
                    {editingId === d.id ? "Save" : "Modify"}
                  </button>
                  <button
                    onClick={() => handleReject(d)}
                    className="flex items-center justify-center gap-1 py-1.5 border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition font-mono text-[10px] uppercase tracking-wider"
                  >
                    <X className="w-3 h-3" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
