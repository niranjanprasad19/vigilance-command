import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Vigilance · Command Console" },
      { name: "description", content: "Operational command dashboard." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-lg">
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan mb-6">— Console Initialization</div>
        <h1 className="font-display text-5xl font-bold mb-6">Command Console <span className="text-cyan">/ Pending</span></h1>
        <p className="text-muted-foreground mb-10">The operational dashboard with Nexus Graph, Chronos timeline, multi-spectral feeds, and Vanguard AI is provisioning. Authentication and live telemetry will be enabled in the next deployment.</p>
        <Link to="/" className="font-mono text-xs uppercase tracking-[0.2em] px-6 py-4 border border-cyan text-cyan hover:bg-cyan hover:text-primary-foreground transition inline-block">← Return to Briefing</Link>
      </div>
    </div>
  );
}
