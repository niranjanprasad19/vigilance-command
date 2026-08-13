import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard, Radar, Video, Network, Clock, ShieldCheck, Send,
  Bot, Crosshair, Scale, History, ScrollText, Menu, X,
} from "lucide-react";
import { useState } from "react";
import { useOps } from "@/lib/ops-context";

type Item = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  gated?: boolean;
};

export function ConsoleSidebar() {
  const ops = useOps();
  const [open, setOpen] = useState(false);

  const items: Item[] = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/console/sensors", label: "Sensors", icon: Radar },
    { to: "/console/video", label: "Video Wall", icon: Video },
    { to: "/console/nexus", label: "Nexus Graph", icon: Network },
    { to: "/console/chronos", label: "Chronos", icon: Clock },
    { to: "/console/approvals", label: "Approvals", icon: ShieldCheck },
    { to: "/console/dispatch", label: "Dispatch", icon: Send },
    { to: "/console/vanguard", label: "Vanguard AI", icon: Bot },
    { to: "/console/tasking", label: "Tasking", icon: Crosshair },
    { to: "/console/roe", label: "ROE Policy", icon: Scale },
    { to: "/console/replay", label: "Replay", icon: History },
    { to: "/console/audit", label: "Audit", icon: ScrollText, gated: !ops.can("audit.view") },
  ];

  const nav = (
    <nav className="flex flex-col gap-0.5 p-2">
      <div className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        Console
      </div>
      {items.map((it) => {
        const Icon = it.icon;
        if (it.gated) {
          return (
            <div
              key={it.to}
              className="flex items-center gap-2.5 px-2.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground opacity-30 cursor-not-allowed"
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="lg:inline">{it.label}</span>
            </div>
          );
        }
        return (
          <Link
            key={it.to}
            to={it.to}
            onClick={() => setOpen(false)}
            activeProps={{ className: "text-cyan bg-cyan/10 border-cyan" }}
            inactiveProps={{ className: "text-muted-foreground border-transparent hover:text-foreground hover:bg-card" }}
            className="flex items-center gap-2.5 px-2.5 py-2 border-l-2 font-mono text-[11px] uppercase tracking-wider transition-colors"
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="lg:hidden fixed bottom-4 left-4 z-40 p-2.5 bg-card border border-border text-cyan"
        aria-label="Toggle console navigation"
      >
        {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {open && (
        <div className="lg:hidden fixed inset-0 z-30 bg-background/80" onClick={() => setOpen(false)}>
          <div className="w-56 h-full bg-card border-r border-border overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {nav}
          </div>
        </div>
      )}

      <aside className="hidden lg:block w-48 shrink-0 border-r border-border bg-card/40 overflow-y-auto">
        {nav}
      </aside>
    </>
  );
}
