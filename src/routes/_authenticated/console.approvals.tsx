import { createFileRoute } from "@tanstack/react-router";
import { PagePanel } from "@/components/dashboard/PagePanel";
import { ApprovalQueue } from "@/components/dashboard/ApprovalQueue";

export const Route = createFileRoute("/_authenticated/console/approvals")({
  head: () => ({
    meta: [
      { title: "Approval Queue · Vigilance" },
      { name: "description", content: "Pending L4 and L5 decisions awaiting human authorisation." },
      { property: "og:title", content: "Approval Queue · Vigilance" },
      { property: "og:description", content: "Pending L4 and L5 decisions awaiting human authorisation." },
    ],
  }),
  component: () => (
    <PagePanel title="Approvals" subtitle="Human-in-the-loop · L4 / L5" scroll={false}>
      <div className="flex-1 lg:min-h-0">
        <ApprovalQueue />
      </div>
    </PagePanel>
  ),
});
