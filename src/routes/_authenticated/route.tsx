import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OpsProvider, useOps } from "@/lib/ops-context";
import { startDecisionEngine } from "@/lib/decision-engine";
import { StatusStrip } from "@/components/dashboard/StatusStrip";
import { OpsBar } from "@/components/dashboard/OpsBar";
import { ThreatLevelStrip } from "@/components/dashboard/ThreatLevelStrip";
import { ConsoleSidebar } from "@/components/dashboard/ConsoleSidebar";
import { DemoInjector } from "@/components/dashboard/DemoInjector";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    }
    return { user: data.user };
  },
  component: () => (
    <OpsProvider>
      <ConsoleShell />
    </OpsProvider>
  ),
});

function ConsoleShell() {
  const ops = useOps();

  useEffect(() => {
    startDecisionEngine();
  }, []);

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-background lg:overflow-hidden relative">
      {ops.mode === "TRAINING" && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center select-none">
          <div className="font-display text-[18vw] font-black text-cyan/[0.04] tracking-widest rotate-[-18deg]">
            TRAINING
          </div>
        </div>
      )}
      {ops.mode === "LIVE" && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-20 ring-2 ring-destructive/40" />
      )}

      <StatusStrip />
      <OpsBar />
      <ThreatLevelStrip />

      <div className="flex-1 flex lg:min-h-0">
        <ConsoleSidebar />
        <div className="flex-1 lg:min-h-0 lg:overflow-hidden flex flex-col">
          <Outlet />
        </div>
      </div>

      <DemoInjector />
    </div>
  );
}
