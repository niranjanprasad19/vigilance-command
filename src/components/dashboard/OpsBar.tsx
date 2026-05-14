import { useEffect, useState } from "react";
import { ShieldCheck, Lock, GraduationCap, Radio, AlertOctagon, Wifi, Satellite, BrainCircuit } from "lucide-react";
import { useOps } from "@/lib/ops-context";
import { ROLE_META, type Role } from "@/lib/rbac";
import { DEGRADED_META, type DegradedMode, getActiveDegraded, setDegraded, subscribeDegraded } from "@/lib/degraded";

const ROLE_ORDER: Role[] = ["operator", "supervisor", "commander", "auditor"];

const DEG_ICON: Record<DegradedMode, React.ReactNode> = {
  "sensor-drop": <Radio className="w-3 h-3" />,
  "comms-loss":  <Wifi className="w-3 h-3" />,
  "gps-jam":     <Satellite className="w-3 h-3" />,
  "ai-degraded": <BrainCircuit className="w-3 h-3" />,
};

export function OpsBar() {
  const { role, mode, setRole, setMode, can } = useOps();
  const [confirmLive, setConfirmLive] = useState(false);
  const [active, setActive] = useState<ReadonlySet<DegradedMode>>(() => getActiveDegraded());

  useEffect(() => {
    const off = subscribeDegraded((s) => setActive(new Set(s)));
    return () => { off(); };
  }, []);

  const liveAllowed = can("ops.toggle_mode");
  const degAllowed = can("ops.toggle_degraded");

  return (
    <div className="border-b border-border bg-card/70 backdrop-blur flex flex-wrap items-center gap-2 md:gap-4 px-3 md:px-5 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em]">
      {/* Mode */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground hidden sm:inline">Mode</span>
        <button
          disabled={!liveAllowed}
          onClick={() => {
            if (mode === "LIVE") { setMode("TRAINING"); setConfirmLive(false); return; }
            if (!confirmLive) { setConfirmLive(true); return; }
            setMode("LIVE"); setConfirmLive(false);
          }}
          className={`flex items-center gap-1.5 px-2 py-1 border transition ${
            mode === "LIVE"
              ? "border-destructive text-destructive bg-destructive/10"
              : "border-cyan/60 text-cyan bg-cyan/5"
          } ${!liveAllowed ? "opacity-50 cursor-not-allowed" : "hover:bg-current/10"}`}
          title={liveAllowed ? "Toggle TRAINING ↔ LIVE" : "Commander only"}
        >
          {mode === "LIVE" ? <Lock className="w-3 h-3" /> : <GraduationCap className="w-3 h-3" />}
          {mode === "LIVE" ? "LIVE OPS" : "TRAINING"}
        </button>
        {confirmLive && mode === "TRAINING" && (
          <span className="text-destructive pulse-dot">⚠ click again to arm LIVE</span>
        )}
      </div>

      <div className="h-4 w-px bg-border hidden md:block" />

      {/* Role */}
      <div className="flex items-center gap-1">
        <ShieldCheck className="w-3 h-3 text-cyan" />
        <span className="text-muted-foreground hidden sm:inline">Role</span>
        {ROLE_ORDER.map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`px-1.5 py-0.5 border transition ${
              role === r
                ? `${ROLE_META[r].tone} border-current bg-current/10`
                : "text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {ROLE_META[r].label}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-border hidden md:block" />

      {/* Degraded */}
      <div className="flex items-center gap-1 flex-wrap">
        <AlertOctagon className={`w-3 h-3 ${active.size ? "text-warning pulse-dot" : "text-muted-foreground"}`} />
        <span className="text-muted-foreground hidden sm:inline">Degrade</span>
        {(Object.keys(DEGRADED_META) as DegradedMode[]).map((m) => {
          const on = active.has(m);
          return (
            <button
              key={m}
              disabled={!degAllowed}
              onClick={() => setDegraded(m, !on)}
              title={DEGRADED_META[m].desc}
              className={`flex items-center gap-1 px-1.5 py-0.5 border transition ${
                on
                  ? "border-warning text-warning bg-warning/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              } ${!degAllowed ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {DEG_ICON[m]} {DEGRADED_META[m].label}
            </button>
          );
        })}
      </div>

      {mode === "TRAINING" && (
        <div className="ml-auto px-2 py-0.5 border border-cyan/40 text-cyan/80 text-[9px]">
          REHEARSAL · no live weapons release
        </div>
      )}
    </div>
  );
}
