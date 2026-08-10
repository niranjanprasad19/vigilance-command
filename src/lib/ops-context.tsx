// Global operations context.
// Role and callsign are ISSUED BY THE SERVER (user_roles table) and are read-only
// in the browser. Mode (TRAINING vs LIVE) is a client control, but every change is
// written to the server-side tamper-evident journal.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { configureAudit, appendAudit, startAuditCapture } from "./audit-log";
import type { Capability, Role } from "./rbac";
import { can, canActOn } from "./rbac";
import type { Decision } from "./threat-levels";
import { setOpsRuntime } from "./ops-runtime";
import { getMySession } from "./ops.functions";

export type OpsMode = "TRAINING" | "LIVE";

type Ctx = {
  role: Role;
  roles: Role[];
  callsign: string;
  unit: string | null;
  userId: string | null;
  loading: boolean;
  mode: OpsMode;
  setMode: (m: OpsMode) => void;
  signOut: () => Promise<void>;
  can: (cap: Capability) => boolean;
  canActOn: (d: Pick<Decision, "level">, a: "approve" | "modify" | "reject") => { allowed: boolean; reason?: string };
};

const OpsContext = createContext<Ctx | null>(null);

const STORAGE = "vigilance.mode";

function loadMode(): OpsMode {
  if (typeof window === "undefined") return "TRAINING";
  return localStorage.getItem(STORAGE) === "LIVE" ? "LIVE" : "TRAINING";
}

export function OpsProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchSession = useServerFn(getMySession);
  const [mode, setModeState] = useState<OpsMode>(loadMode);

  const { data, isLoading } = useQuery({
    queryKey: ["ops-session"],
    queryFn: () => fetchSession(),
    staleTime: 60_000,
  });

  const role = (data?.role ?? "operator") as Role;
  const roles = (data?.roles ?? []) as Role[];

  useEffect(() => {
    configureAudit({ mode: () => mode, actor: () => role });
    setOpsRuntime(mode, role);
    startAuditCapture();
  }, [mode, role]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(STORAGE, mode);
  }, [mode]);

  const setMode = useCallback((m: OpsMode) => {
    setModeState((prev) => {
      if (prev !== m) void appendAudit("MODE_CHANGE", { from: prev, to: m }, m, "CONFIDENTIAL");
      return m;
    });
  }, []);

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true, search: { redirect: "/dashboard" } });
  }, [navigate, queryClient]);

  const value = useMemo<Ctx>(() => ({
    role,
    roles,
    callsign: data?.callsign ?? "—",
    unit: data?.unit ?? null,
    userId: data?.userId ?? null,
    loading: isLoading,
    mode,
    setMode,
    signOut,
    can: (cap) => can(role, cap),
    canActOn: (d, a) => canActOn(role, d, a),
  }), [role, roles, data, isLoading, mode, setMode, signOut]);

  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}

export function useOps(): Ctx {
  const v = useContext(OpsContext);
  if (!v) throw new Error("useOps must be used within OpsProvider");
  return v;
}
