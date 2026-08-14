import { useEffect, useRef, useState } from "react";
import { Check, Edit3, X, Shield, Clock, Lock, KeyRound, Fingerprint } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBus } from "@/lib/telemetry";
import { resolveDecision, type ResolveResult } from "@/lib/decision-engine";
import { LEVEL_META, type Decision } from "@/lib/threat-levels";
import { useOps } from "@/lib/ops-context";
import { ROLE_META } from "@/lib/rbac";
import { getMfaStatus } from "@/lib/auth.stepup.functions";
import { MfaEnroll, MfaStepUp } from "./MfaGate";

type StepUp = { token: string; expiresAt: number } | null;

export function ApprovalQueue() {
  const ops = useOps();
  const qc = useQueryClient();
  const fetchMfa = useServerFn(getMfaStatus);
  const [queue, setQueue] = useState<Decision[]>([]);
  const [now, setNow] = useState(Date.now());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  // Decisions where the first commander key is already held → awaiting
  // a second, distinct commander (with step-up) to finalise.
  const [firstKeyHeld, setFirstKeyHeld] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Step-up token for the in-progress finalise, and which decision asked for it.
  const [stepUp, setStepUp] = useState<StepUp>(null);
  const [mfaFor, setMfaFor] = useState<string | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const tRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mfaQ = useQuery({ queryKey: ["mfa-status"], queryFn: () => fetchMfa(), staleTime: 30_000 });
  const mfaEnrolled = !!mfaQ.data?.enrolled;
  const mfaFactorId = mfaQ.data?.factorId ?? null;

  // Clear step-up token when it expires.
  useEffect(() => {
    if (!stepUp) return;
    const t = setTimeout(() => setStepUp(null), Math.max(0, stepUp.expiresAt - Date.now()));
    return () => clearTimeout(t);
  }, [stepUp]);

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

  const runResolve = async (
    d: Decision,
    outcome: "APPROVED" | "MODIFIED" | "REJECTED",
    modifiedAction?: string,
    token?: string,
  ): Promise<ResolveResult> => {
    setBusyId(d.id);
    setErr(null);
    const res = await resolveDecision(d.id, outcome, modifiedAction, token);
    setBusyId(null);
    if (!res.ok) {
      setErr(res.reason ?? "Denied");
      return res;
    }
    if (!res.finalized) {
      // First key accepted — record it and await the second commander.
      setFirstKeyHeld((s) => new Set(s).add(d.id));
    } else {
      setFirstKeyHeld((s) => { const n = new Set(s); n.delete(d.id); return n; });
      setMfaFor(null);
    }
    qc.invalidateQueries({ queryKey: ["audit-log"] });
    return res;
  };

  const handleApprove = async (d: Decision) => {
    if (!ops.canActOn(d, "approve").allowed) return;
    const finalising = firstKeyHeld.has(d.id);
    if (finalising) {
      // Second key needs step-up authentication.
      if (!mfaEnrolled) { setEnrollOpen(true); return; }
      if (!stepUp || stepUp.expiresAt <= Date.now()) { setMfaFor(d.id); return; }
      await runResolve(d, "APPROVED", undefined, stepUp.token);
      setStepUp(null);
    } else {
      await runResolve(d, "APPROVED");
    }
  };
  const handleModify = (d: Decision) => {
    if (!ops.canActOn(d, "modify").allowed) return;
    if (editingId === d.id) {
      void runResolve(d, "MODIFIED", editValue.trim() || d.action, stepUp?.token);
      setEditingId(null);
    } else {
      setEditingId(d.id);
      setEditValue(d.action);
    }
  };
  const handleReject = (d: Decision) => {
    if (!ops.canActOn(d, "reject").allowed) return;
    void runResolve(d, "REJECTED");
  };

  const onStepUpToken = async (token: string, expiresAt: number) => {
    setStepUp({ token, expiresAt });
    setMfaFor(null);
    const d = queue.find((x) => x.id === (mfaFor ?? ""));
    if (d) await runResolve(d, "APPROVED", undefined, token);
    setStepUp(null);
  };

  return (
    <div className="bg-card flex flex-col h-full">
      {enrollOpen && mfaFactorId === null && (
        <MfaEnroll
          onDone={() => { setEnrollOpen(false); qc.invalidateQueries({ queryKey: ["mfa-status"] }); }}
          onClose={() => setEnrollOpen(false)}
        />
      )}
      {mfaFor && mfaFactorId && (
        <MfaStepUp
          factorId={mfaFactorId}
          onClose={() => setMfaFor(null)}
          onToken={onStepUpToken}
        />
      )}

      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Shield className="w-3 h-3 text-warning" />
          Approval Queue · Human-in-the-Loop
        </div>
        <div className="flex items-center gap-1.5">
          {mfaEnrolled ? (
            <span className="font-mono text-[9px] px-1.5 py-0.5 border border-cyan/50 text-cyan flex items-center gap-1" title="MFA enrolled">
              <Fingerprint className="w-2.5 h-2.5" /> MFA
            </span>
          ) : (
            <button
              onClick={() => setEnrollOpen(true)}
              className="font-mono text-[9px] px-1.5 py-0.5 border border-warning/60 text-warning flex items-center gap-1 hover:bg-warning/10"
              title="Enroll TOTP to enable step-up for L5"
            >
              <KeyRound className="w-2.5 h-2.5" /> Enroll MFA
            </button>
          )}
          {stepUp && (
            <span className="font-mono text-[9px] px-1.5 py-0.5 border border-cyan text-cyan" title="Step-up token active">
              STEP-UP
            </span>
          )}
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 border ${
              queue.length > 0 ? "border-warning text-warning pulse-dot" : "border-cyan/40 text-cyan"
            }`}
          >
            {queue.length > 0 ? `${queue.length} PENDING` : "ALL CLEAR"}
          </span>
        </div>
      </div>

      {err && (
        <div className="px-4 py-1.5 border-b border-destructive/40 font-mono text-[10px] text-destructive flex items-center justify-between">
          <span>{err}</span>
          <button onClick={() => setErr(null)} className="text-destructive/70 hover:text-destructive"><X className="w-3 h-3" /></button>
        </div>
      )}

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
          const awaitingSecond = dual && firstKeyHeld.has(d.id);
          const isBusy = busyId === d.id;

          return (
            <div
              key={d.id}
              className={`border ${m.border} ${m.bg} relative overflow-hidden`}
            >
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

                {d.provenance && (
                  <div className="font-mono text-[9px] text-cyan/80 flex items-center gap-1.5 border-l-2 border-cyan/30 pl-2">
                    <span className="uppercase tracking-wider text-muted-foreground">src</span>
                    {d.provenance.sensorId}
                    <span className="text-muted-foreground">·</span>
                    {d.provenance.band}
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{d.provenance.fusionStep}</span>
                  </div>
                )}

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

                {awaitingSecond && (
                  <div className="font-mono text-[10px] text-warning border border-warning/60 px-2 py-1 pulse-dot flex items-center gap-1.5">
                    <KeyRound className="w-2.5 h-2.5" />
                    First key held — awaiting second commander. Step-up required to finalise.
                  </div>
                )}

                {(() => {
                  const ap = ops.canActOn(d, "approve");
                  const md = ops.canActOn(d, "modify");
                  const rj = ops.canActOn(d, "reject");
                  const denied = !ap.allowed && !md.allowed && !rj.allowed;
                  return (
                    <>
                      {denied && (
                        <div className="font-mono text-[9px] text-muted-foreground border border-border px-2 py-1 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          {ROLE_META[ops.role].label} is read-only for this decision.
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          onClick={() => handleApprove(d)}
                          disabled={!ap.allowed || isBusy}
                          title={ap.reason}
                          className="flex items-center justify-center gap-1 py-1.5 border border-cyan text-cyan hover:bg-cyan hover:text-primary-foreground transition font-mono text-[10px] uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-cyan"
                        >
                          {awaitingSecond ? "Finalise" : "Approve"}
                        </button>
                        <button
                          onClick={() => handleModify(d)}
                          disabled={!md.allowed || isBusy}
                          title={md.reason}
                          className="flex items-center justify-center gap-1 py-1.5 border border-warning text-warning hover:bg-warning hover:text-primary-foreground transition font-mono text-[10px] uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-warning"
                        >
                          <Edit3 className="w-3 h-3" />
                          {editingId === d.id ? "Save" : "Modify"}
                        </button>
                        <button
                          onClick={() => handleReject(d)}
                          disabled={!rj.allowed || isBusy}
                          title={rj.reason}
                          className="flex items-center justify-center gap-1 py-1.5 border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition font-mono text-[10px] uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                          Reject
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
