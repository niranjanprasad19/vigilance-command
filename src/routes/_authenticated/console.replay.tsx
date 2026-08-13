import { createFileRoute } from "@tanstack/react-router";
import { PagePanel } from "@/components/dashboard/PagePanel";
import { ReplayPanel } from "@/components/dashboard/ReplayPanel";

export const Route = createFileRoute("/_authenticated/console/replay")({
  head: () => ({
    meta: [
      { title: "Incident Replay · Vigilance" },
      { name: "description", content: "After-action reconstruction of stored decisions and tasking timelines." },
      { property: "og:title", content: "Incident Replay · Vigilance" },
      { property: "og:description", content: "After-action reconstruction of stored decisions and tasking timelines." },
    ],
  }),
  component: () => (
    <PagePanel title="Replay" subtitle="After-action review" scroll={false}>
      <div className="flex-1 lg:min-h-0">
        <ReplayPanel />
      </div>
    </PagePanel>
  ),
});
