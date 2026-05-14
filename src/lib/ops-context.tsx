// Global operations context: role (RBAC), mode (TRAINING vs LIVE), and degraded state.
// Wires the audit log to the current actor + mode.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { appendAudit, configureAudit, startAuditCapture } from "./audit-log";
import type { Capability, Role } from "./rbac";
import { can, canActOn } from "./rbac";
import type { Decision } from "./threat-levels";
import { setOpsRuntime } from "./ops-runtime";

export type OpsMode = "TRAINING" | "LIVE";

type Ctx = {
  role: Role;
  mode: OpsMode;
  setRole: (r: Role) => void;
  setMode: (m: OpsMode) => void;
  can: (cap: Capability) => boolean;
  canActOn: (d: Pick<Decision, "level">, a: "approve" | "modify" | "reject") => { allowed: boolean; reason?: string };
};

const OpsContext = createContext<Ctx | null>(null);

const STORAGE = "vigilance.ops";
type Persisted = { role: Role; mode: OpsMode };

function loadPersisted(): Persisted {
  if (typeof window === "undefined") return { role: "operator", mode: "TRAINING" };
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) return JSON.parse(raw) as Persisted;
  } catch { /* ignore */ }
  return { role: "operator", mode: "TRAINING" };
}

export function OpsProvider({ children }: { children: React.ReactNode }) {
  const initial = loadPersisted();
  const [role, setRoleState] = useState<Role>(initial.role);
  const [mode, setModeState] = useState<OpsMode>(initial.mode);

  // Keep audit-log + ops-runtime in sync with current actor + mode.
  useEffect(() => {
    configureAudit({ mode: () => mode, actor: () => role });
    setOpsRuntime(mode, role);
    startAuditCapture();
  }, [mode, role]);

  // Persist
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE, JSON.stringify({ role, mode }));
    }
  }, [role, mode]);

  const setRole = useCallback((r: Role) => {
    setRoleState((prev) => {
      if (prev !== r) appendAudit("ROLE_CHANGE", { from: prev, to: r }, "system");
      return r;
    });
  }, []);

  const setMode = useCallback((m: OpsMode) => {
    setModeState((prev) => {
      if (prev !== m) appendAudit("MODE_CHANGE", { from: prev, to: m });
      return m;
    });
  }, []);

  const value = useMemo<Ctx>(() => ({
    role, mode, setRole, setMode,
    can: (cap) => can(role, cap),
    canActOn: (d, a) => canActOn(role, d, a),
  }), [role, mode, setRole, setMode]);

  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}

export function useOps(): Ctx {
  const v = useContext(OpsContext);
  if (!v) throw new Error("useOps must be used within OpsProvider");
  return v;
}
