import { createFileRoute } from "@tanstack/react-router";
import { PagePanel } from "@/components/dashboard/PagePanel";
import { AuditLogPanel } from "@/components/dashboard/AuditLogPanel";
import { useOps } from "@/lib/ops-context";

export const Route = createFileRoute("/_authenticated/console/audit")({
  head: () => ({
    meta: [
      { title: "Audit Journal · Vigilance" },
      { name: "description", content: "Append-only, hash-chained journal of every decision, override and dispatch." },
      { property: "og:title", content: "Audit Journal · Vigilance" },
      { property: "og:description", content: "Append-only, hash-chained journal of every decision, override and dispatch." },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const ops = useOps();
  return (
    <PagePanel title="Audit Journal" subtitle="Tamper-evident chain" scroll={false}>
      {ops.can("audit.view") ? (
        <div className="flex-1 lg:min-h-0">
          <AuditLogPanel />
        </div>
      ) : (
        <div className="p-6 font-mono text-xs text-destructive">
          ACCESS DENIED · audit.view capability required.
        </div>
      )}
    </PagePanel>
  );
}
