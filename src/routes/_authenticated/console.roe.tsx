import { createFileRoute } from "@tanstack/react-router";
import { PagePanel } from "@/components/dashboard/PagePanel";
import { RoePanel } from "@/components/dashboard/RoePanel";

export const Route = createFileRoute("/_authenticated/console/roe")({
  head: () => ({
    meta: [
      { title: "ROE Policy · Vigilance" },
      { name: "description", content: "Versioned rules-of-engagement thresholds, ceilings and dual-key floors." },
      { property: "og:title", content: "ROE Policy · Vigilance" },
      { property: "og:description", content: "Versioned rules-of-engagement thresholds, ceilings and dual-key floors." },
    ],
  }),
  component: () => (
    <PagePanel title="ROE Policy" subtitle="Versioned · commander-editable" scroll={false}>
      <div className="flex-1 lg:min-h-0">
        <RoePanel />
      </div>
    </PagePanel>
  ),
});
