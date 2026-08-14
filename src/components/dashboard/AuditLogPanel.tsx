import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, ShieldAlert, Download, FlaskConical, RefreshCw, Lock, FileLock2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { subscribeAudit, type AuditEntry } from "@/lib/audit-log";
import { listAudit, verifyAuditChain } from "@/lib/ops.functions";
import { signAuditRoot, verifyAuditRoots, exportAuditBundle } from "@/lib/audit.merkle.functions";
import { supabase } from "@/integrations/supabase/client";
import { useOps } from "@/lib/ops-context";

const KIND_TONE: Record<string, string> = {
  DECISION_AUTO:      "text-cyan",
  DECISION_PENDING:   "text-warning",
  DECISION_RESOLVED:  "text-cyan",
  DECISION_FIRST_KEY: "text-warning",
  TASKING_DISPATCH:   "text-cyan",
  ROLE_CHANGE:        "text-muted-foreground",
  MODE_CHANGE:        "text-warning",
  DEGRADED_TOGGLE:    "text-warning",
  ROE_PUBLISHED:      "text-warning",
  AUDIT_ROOT_SEALED:  "text-cyan",
  TAMPER_ATTEMPT:     "text-destructive",
};

export function AuditLogPanel() {
  const { can } = useOps();
  const qc = useQueryClient();
  const fetchLog = useServerFn(listAudit);
  const fetchVerdict = useServerFn(verifyAuditChain);
  const fetchRootsVerdict = useServerFn(verifyAuditRoots);
  const seal = useServerFn(signAuditRoot);
  const exportBundle = useServerFn(exportAuditBundle);
  const [filter, setFilter] = useState("");
  const [tamperMsg, setTamperMsg] = useState<string | null>(null);
  const [sealMsg, setSealMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const logQ = useQuery({ queryKey: ["audit-log"], queryFn: () => fetchLog(), refetchInterval: 5000 });
  const verifyQ = useQuery({ queryKey: ["audit-verify"], queryFn: () => fetchVerdict(), refetchInterval: 8000 });
  const rootsQ = useQuery({ queryKey: ["audit-roots"], queryFn: () => fetchRootsVerdict(), refetchInterval: 15000 });

  useEffect(() => subscribeAudit(() => {
    qc.invalidateQueries({ queryKey: ["audit-log"] });
    qc.invalidateQueries({ queryKey: ["audit-verify"] });
    qc.invalidateQueries({ queryKey: ["audit-roots"] });
  }), [qc]);

  const entries = (logQ.data ?? []) as unknown as AuditEntry[];

  const log = useMemo(() => {
    if (!filter) return entries;
    const f = filter.toLowerCase();
    return entries.filter((e) =>
      e.kind.toLowerCase().includes(f) ||
      (e.actor_role ?? "").toLowerCase().includes(f) ||
      JSON.stringify(e.payload).toLowerCase().includes(f),
    );
  }, [filter, entries]);

  const handleExport = async () => {
    const bundle = await exportBundle({ data: { limit: 400 } });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vigilance-evidence-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSeal = async () => {
    setBusy(true); setSealMsg(null);
    const res = await seal({});
    setBusy(false);
    if (res.ok) {
      setSealMsg(`SEALED · window #${res.windowStart}–${res.windowEnd} · ${res.entryCount} entries · root ${res.rootHash.slice(0, 12)}`);
      qc.invalidateQueries({ queryKey: ["audit-roots"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    } else {
      setSealMsg(res.reason ?? "Seal failed");
    }
  };

  // Demo: attempt to rewrite history from a fully authenticated client session.
  const attemptTamper = async () => {
    const target = entries[Math.floor(entries.length / 2)];
    if (!target) { setTamperMsg("No entries to tamper with yet."); return; }
    const { error, data } = await supabase
      .from("audit_entries")
      .update({ payload: { tampered: true } })
      .eq("seq", target.seq)
      .select();
    if (error || !data || data.length === 0) {
      setTamperMsg(`REFUSED · entry #${target.seq} is immutable (${error?.code ?? "0 rows affected"})`);
    } else {
      setTamperMsg(`WARNING · entry #${target.seq} was modified — chain verification will now fail.`);
    }
    qc.invalidateQueries({ queryKey: ["audit-verify"] });
    qc.invalidateQueries({ queryKey: ["audit-roots"] });
  };

  const verdict = verifyQ.data;
  const ok = verdict?.ok ?? true;
  const roots = rootsQ.data;
  const rootsOk = roots?.ok ?? true;

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {ok && rootsOk
            ? <ShieldCheck className="w-3 h-3 text-cyan" />
            : <ShieldAlert className="w-3 h-3 text-destructive pulse-dot" />}
          Journal · SHA-256 chain
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`font-mono text-[9px] px-1.5 py-0.5 border ${
            ok ? "border-cyan/50 text-cyan" : "border-destructive text-destructive pulse-dot"
          }`}>
            {ok ? `CHAIN · ${verdict?.total ?? 0}` : `BROKEN @ #${verdict?.brokenAt}`}
          </div>
          <div className={`font-mono text-[9px] px-1.5 py-0.5 border ${
            rootsOk ? "border-cyan/50 text-cyan" : "border-destructive text-destructive"
          }`} title="Signed Merkle roots">
            {rootsOk ? `ROOTS · ${roots?.rootsChecked ?? 0}/${roots?.totalRoots ?? 0}` : `ROOT BROKEN @ ${roots?.brokenAt ?? "?"}`}
          </div>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-border flex flex-wrap items-center gap-1.5">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter…"
          maxLength={80}
          className="flex-1 min-w-[110px] bg-background border border-border px-2 py-1 font-mono text-[10px] outline-none focus:border-cyan"
        />
        <button
          onClick={() => { logQ.refetch(); verifyQ.refetch(); rootsQ.refetch(); }}
          className="flex items-center gap-1 px-2 py-1 border border-border text-muted-foreground hover:text-cyan hover:border-cyan font-mono text-[10px] uppercase"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
        {can("audit.export") && (
          <>
            <button
              onClick={handleSeal}
              disabled={busy}
              title="Seal all unsealed entries into a signed Merkle root (Commander/Auditor)."
              className="flex items-center gap-1 px-2 py-1 border border-cyan/60 text-cyan hover:bg-cyan/10 font-mono text-[10px] uppercase tracking-wider disabled:opacity-40"
            >
              <Lock className="w-3 h-3" /> {busy ? "Sealing…" : "Seal"}
            </button>
            <button
              onClick={handleExport}
              title="Export a signed evidence bundle (entries + sealed roots + verification)."
              className="flex items-center gap-1 px-2 py-1 border border-cyan/60 text-cyan hover:bg-cyan/10 font-mono text-[10px] uppercase tracking-wider"
            >
              <FileLock2 className="w-3 h-3" /> Evidence
            </button>
          </>
        )}
        <button
          onClick={attemptTamper}
          title="Demo: try to rewrite a journal entry directly from an authenticated session."
          className="flex items-center gap-1 px-2 py-1 border border-warning/60 text-warning hover:bg-warning/10 font-mono text-[10px] uppercase tracking-wider"
        >
          <FlaskConical className="w-3 h-3" /> Tamper
        </button>
      </div>

      {sealMsg && (
        <div className="px-3 py-1.5 border-b border-border font-mono text-[10px] text-cyan flex items-center justify-between">
          <span>{sealMsg}</span>
          <button onClick={() => setSealMsg(null)} className="text-muted-foreground hover:text-foreground">×</button>
        </div>
      )}
      {tamperMsg && (
        <div className={`px-3 py-1.5 border-b border-border font-mono text-[10px] ${
          tamperMsg.startsWith("REFUSED") ? "text-cyan" : "text-destructive"
        }`}>
          {tamperMsg}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 font-mono text-[10px]">
        {log.length === 0 && (
          <div className="text-muted-foreground px-2 py-3 opacity-60">
            No journal entries visible. Trigger a decision, or check that your role can read the journal.
          </div>
        )}
        {log.map((e) => {
          const ts = new Date(e.ts).toISOString().substring(11, 19);
          const isRoot = e.kind === "AUDIT_ROOT_SEALED";
          return (
            <div key={e.seq} className={`border-l-2 pl-2 py-1 ${isRoot ? "border-cyan" : "border-border"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-muted-foreground tabular-nums">#{e.seq}</span>
                  <span className="text-muted-foreground tabular-nums">{ts}</span>
                  <span className={KIND_TONE[e.kind] ?? "text-foreground"}>{e.kind}</span>
                  <span className={`px-1 py-px border text-[8px] uppercase ${
                    e.mode === "LIVE" ? "border-destructive text-destructive" : "border-cyan/40 text-cyan"
                  }`}>{e.mode}</span>
                  <span className="px-1 py-px border border-border text-[8px] uppercase text-muted-foreground">
                    {e.classification}
                  </span>
                  {e.actor_role && (
                    <span className="text-[9px] text-muted-foreground uppercase">{e.actor_role}</span>
                  )}
                </div>
                <span className="text-muted-foreground text-[9px] truncate max-w-[70px]" title={e.hash}>
                  {e.hash.slice(0, 10)}
                </span>
              </div>
              <div className="text-muted-foreground/80 truncate mt-0.5" title={JSON.stringify(e.payload)}>
                {JSON.stringify(e.payload)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
