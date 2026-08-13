import { createFileRoute } from "@tanstack/react-router";
import { PagePanel } from "@/components/dashboard/PagePanel";
import { SensorFeeds } from "@/components/dashboard/SensorFeeds";
import { DecisionLog } from "@/components/dashboard/DecisionLog";

export const Route = createFileRoute("/_authenticated/console/sensors")({
  head: () => ({
    meta: [
      { title: "Sensor Feeds · Vigilance" },
      { name: "description", content: "Live sensor health, coverage and telemetry status across all sectors." },
      { property: "og:title", content: "Sensor Feeds · Vigilance" },
      { property: "og:description", content: "Live sensor health, coverage and telemetry status across all sectors." },
    ],
  }),
  component: () => (
    <PagePanel title="Sensor Feeds" subtitle="Live telemetry · all sectors">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-px bg-border">
        <div className="bg-background">
          <SensorFeeds />
        </div>
        <div className="bg-background flex flex-col min-h-[320px]">
          <DecisionLog />
        </div>
      </div>
    </PagePanel>
  ),
});
