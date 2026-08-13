import { createFileRoute } from "@tanstack/react-router";
import { PagePanel } from "@/components/dashboard/PagePanel";
import { CommandDispatchFeed } from "@/components/dashboard/CommandDispatchFeed";

export const Route = createFileRoute("/_authenticated/console/dispatch")({
  head: () => ({
    meta: [
      { title: "Command Dispatch · Vigilance" },
      { name: "description", content: "Live stream of tasking orders dispatched by AI and human operators." },
      { property: "og:title", content: "Command Dispatch · Vigilance" },
      { property: "og:description", content: "Live stream of tasking orders dispatched by AI and human operators." },
    ],
  }),
  component: () => (
    <PagePanel title="Dispatch" subtitle="Tasking order stream" scroll={false}>
      <div className="flex-1 lg:min-h-0">
        <CommandDispatchFeed />
      </div>
    </PagePanel>
  ),
});
