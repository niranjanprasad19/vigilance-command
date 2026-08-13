import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PagePanel } from "@/components/dashboard/PagePanel";
import { NexusGraph } from "@/components/dashboard/NexusGraph";
import { EntityDetail } from "@/components/dashboard/EntityDetail";
import type { Entity } from "@/lib/telemetry";

export const Route = createFileRoute("/_authenticated/console/nexus")({
  head: () => ({
    meta: [
      { title: "Nexus Graph · Vigilance" },
      { name: "description", content: "Entity link analysis with ghost-track projections and relationship inspection." },
      { property: "og:title", content: "Nexus Graph · Vigilance" },
      { property: "og:description", content: "Entity link analysis with ghost-track projections and relationship inspection." },
    ],
  }),
  component: NexusPage,
});

function NexusPage() {
  const [selected, setSelected] = useState<Entity | null>(null);
  return (
    <PagePanel title="Nexus Graph" subtitle="Ontology · link analysis" scroll={false}>
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-4 gap-px bg-border lg:min-h-0">
        <div className="xl:col-span-3 bg-background grid-bg-fine relative" style={{ minHeight: 420 }}>
          <NexusGraph onSelect={setSelected} selectedId={selected?.id ?? null} />
        </div>
        <div className="bg-background lg:overflow-y-auto">
          <EntityDetail entity={selected} />
        </div>
      </div>
    </PagePanel>
  );
}
