import { createFileRoute } from "@tanstack/react-router";
import { PagePanel } from "@/components/dashboard/PagePanel";
import { ChronosTimeline } from "@/components/dashboard/ChronosTimeline";
import { DecisionLog } from "@/components/dashboard/DecisionLog";

export const Route = createFileRoute("/_authenticated/console/chronos")({
  head: () => ({
    meta: [
      { title: "Chronos Timeline · Vigilance" },
      { name: "description", content: "Predictive threat timeline plotting forecast events and active alerts." },
      { property: "og:title", content: "Chronos Timeline · Vigilance" },
      { property: "og:description", content: "Predictive threat timeline plotting forecast events and active alerts." },
    ],
  }),
  component: () => (
    <PagePanel title="Chronos" subtitle="Predictive timeline">
      <ChronosTimeline />
      <div className="border-t border-border flex flex-col min-h-[320px]">
        <DecisionLog />
      </div>
    </PagePanel>
  ),
});
