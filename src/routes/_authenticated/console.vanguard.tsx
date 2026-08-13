import { createFileRoute } from "@tanstack/react-router";
import { PagePanel } from "@/components/dashboard/PagePanel";
import { VanguardConsole } from "@/components/dashboard/VanguardConsole";

export const Route = createFileRoute("/_authenticated/console/vanguard")({
  head: () => ({
    meta: [
      { title: "Vanguard AI · Vigilance" },
      { name: "description", content: "Advisory AI copilot for battlespace briefings and situational queries." },
      { property: "og:title", content: "Vanguard AI · Vigilance" },
      { property: "og:description", content: "Advisory AI copilot for battlespace briefings and situational queries." },
    ],
  }),
  component: () => (
    <PagePanel title="Vanguard AI" subtitle="Advisory copilot" scroll={false}>
      <div className="flex-1 lg:min-h-0 min-h-[520px]">
        <VanguardConsole />
      </div>
    </PagePanel>
  ),
});
