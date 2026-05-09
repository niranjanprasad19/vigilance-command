import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { StatusStrip } from "@/components/dashboard/StatusStrip";
import { SensorFeeds } from "@/components/dashboard/SensorFeeds";
import { NexusGraph } from "@/components/dashboard/NexusGraph";
import { ChronosTimeline } from "@/components/dashboard/ChronosTimeline";
import { VanguardConsole } from "@/components/dashboard/VanguardConsole";
import { TaskingConsole } from "@/components/dashboard/TaskingConsole";
import { EntityDetail } from "@/components/dashboard/EntityDetail";
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

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <StatusStrip />

      <div className="flex-1 grid grid-cols-12 gap-px bg-border min-h-0">
        {/* Left rail: sensor feeds */}
        <aside className="col-span-3 bg-background flex flex-col min-h-0">
          <div className="px-4 py-2 border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Sensor Feeds · Live
          </div>
          <div className="overflow-y-auto flex-1">
            <SensorFeeds />
          </div>
        </aside>

        {/* Center: Nexus Graph */}
        <main className="col-span-6 bg-background flex flex-col min-h-0">
          <div className="flex-1 min-h-0 grid-bg-fine">
            <NexusGraph onSelect={setSelected} selectedId={selected?.id ?? null} />
          </div>
          <div className="border-t border-border max-h-56 overflow-hidden">
            {selected ? <EntityDetail entity={selected} /> : <EntityDetail entity={null} />}
          </div>
        </main>

        {/* Right rail: Vanguard + Tasking */}
        <aside className="col-span-3 bg-background grid grid-rows-2 min-h-0">
          <div className="border-b border-border min-h-0">
            <VanguardConsole />
          </div>
          <div className="min-h-0">
            <TaskingConsole />
          </div>
        </aside>
      </div>

      {/* Bottom: Chronos timeline */}
      <ChronosTimeline />
    </div>
  );
}
