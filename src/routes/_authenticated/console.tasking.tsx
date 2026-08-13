import { createFileRoute } from "@tanstack/react-router";
import { PagePanel } from "@/components/dashboard/PagePanel";
import { TaskingConsole } from "@/components/dashboard/TaskingConsole";

export const Route = createFileRoute("/_authenticated/console/tasking")({
  head: () => ({
    meta: [
      { title: "Asset Tasking · Vigilance" },
      { name: "description", content: "Dispatch drone and ground asset tasking orders to sectors." },
      { property: "og:title", content: "Asset Tasking · Vigilance" },
      { property: "og:description", content: "Dispatch drone and ground asset tasking orders to sectors." },
    ],
  }),
  component: () => (
    <PagePanel title="Tasking" subtitle="Asset dispatch console" scroll={false}>
      <div className="flex-1 lg:min-h-0">
        <TaskingConsole />
      </div>
    </PagePanel>
  ),
});
