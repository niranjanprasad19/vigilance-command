import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StatusStrip } from "@/components/dashboard/StatusStrip";
import { ThreatLevelStrip } from "@/components/dashboard/ThreatLevelStrip";
import { SensorFeeds } from "@/components/dashboard/SensorFeeds";
import { NexusGraph } from "@/components/dashboard/NexusGraph";
import { ChronosTimeline } from "@/components/dashboard/ChronosTimeline";
import { VanguardConsole } from "@/components/dashboard/VanguardConsole";
import { TaskingConsole } from "@/components/dashboard/TaskingConsole";
import { EntityDetail } from "@/components/dashboard/EntityDetail";
import { VideoWall } from "@/components/dashboard/VideoWall";
import { ApprovalQueue } from "@/components/dashboard/ApprovalQueue";
import { DecisionLog } from "@/components/dashboard/DecisionLog";
import { DemoInjector } from "@/components/dashboard/DemoInjector";
import { CommandDispatchFeed } from "@/components/dashboard/CommandDispatchFeed";
import { startDecisionEngine } from "@/lib/decision-engine";
import type { Entity } from "@/lib/telemetry";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Vigilance · Command Console" },
      { name: "description", content: "Real-time multi-domain operational dashboard." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [selected, setSelected] = useState<Entity | null>(null);
  const [rightTab, setRightTab] = useState<"approvals" | "vanguard" | "tasking">("approvals");

  useEffect(() => {
    startDecisionEngine();
  }, []);

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-background lg:overflow-hidden">
      <StatusStrip />
      <ThreatLevelStrip />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-px bg-border lg:min-h-0">
        {/* Left rail: sensor feeds + decision log */}
        <aside className="lg:col-span-3 bg-background flex flex-col lg:min-h-0 order-2 lg:order-1">
          <div className="lg:flex-1 lg:min-h-0 flex flex-col">
            <SectionLabel>Sensor Feeds · Live</SectionLabel>
            <div className="lg:overflow-y-auto lg:flex-1">
              <SensorFeeds />
            </div>
          </div>
          <div className="border-t border-border lg:h-64 lg:min-h-0 flex flex-col">
            <DecisionLog />
          </div>
        </aside>

        {/* Center: Video wall + Nexus Graph */}
        <main className="lg:col-span-6 bg-background flex flex-col lg:min-h-0 order-1 lg:order-2">
          <VideoWall selectedEntity={selected} onSelectEntity={setSelected} />
          <div className="flex-1 lg:min-h-0 grid-bg-fine relative" style={{ minHeight: 360 }}>
            <NexusGraph onSelect={setSelected} selectedId={selected?.id ?? null} />
          </div>
          <div className="border-t border-border lg:max-h-56 lg:overflow-hidden">
            <EntityDetail entity={selected} />
          </div>
        </main>

        {/* Right rail: tabbed Approvals / Vanguard / Tasking */}
        <aside className="lg:col-span-3 bg-background flex flex-col lg:min-h-0 order-3">
          <div className="flex border-b border-border bg-card/50">
            {(["approvals", "vanguard", "tasking"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setRightTab(t)}
                className={`flex-1 py-2 px-2 font-mono text-[10px] uppercase tracking-[0.2em] transition border-b-2 ${
                  rightTab === t
                    ? "text-cyan border-cyan bg-background"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                {t === "approvals" ? "Approvals" : t === "vanguard" ? "Vanguard AI" : "Tasking"}
              </button>
            ))}
          </div>
          <div className="flex-1 lg:min-h-0 min-h-[420px]">
            {rightTab === "approvals" && <ApprovalQueue />}
            {rightTab === "vanguard" && <VanguardConsole />}
            {rightTab === "tasking" && <TaskingConsole />}
          </div>
        </aside>
      </div>

      {/* Bottom: Chronos timeline */}
      <ChronosTimeline />

      <DemoInjector />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2 border-b border-border font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
      <span className="w-1 h-1 bg-cyan rounded-full pulse-dot" />
      {children}
    </div>
  );
}
