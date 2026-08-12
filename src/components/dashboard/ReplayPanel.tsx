// After-action replay — reconstructs an incident window from STORED events
// (decisions + tasking orders), not from anything still in browser memory.

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { replayWindow } from "@/lib/ops.functions";

const WINDOWS = [15, 30, 60, 240, 1440];

type Item = {
  ts: number;
  kind: "DECISION" | "TASKING";
  title: string;
  detail: string;
  status: string;
  level?: number | null;
};

export function ReplayPanel() {
  const run = useServerFn(replayWindow);
  const [minutes, setMinutes] = useState(30);
  const [items, setItems] = useState<Item[] | null>(null);

  const mutation = useMutation({
    mutationFn: () => run({ data: { minutes } }),
    onSuccess: (res) => {
      const merged: Item[] = [
        ...res.decisions.map((d) => ({
          ts: new Date(d.created_at).getTime(),
          kind: "DECISION" as const,
          title: `L${d.level} · ${d.entity_label ?? d.event_id}`,
          detail: `${d.modified_action ?? d.action} — ${d.rationale}`,
          status: d.status,
          level: d.level,
        })),
        ...res.tasking.map((t) => ({
          ts: new Date(t.created_at).getTime(),
          kind: "TASKING" as const,
          title: `${t.asset} · ${t.source}`,
          detail: t.directive,
          status: t.status,
          level: t.trigger_level,
        })),
      ].sort((a, b) => a.ts - b.ts);
      setItems(merged);
    },
  });

  function exportJson() {
    const blob = new Blob([JSON.stringify({ minutes, items }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vigilance-replay-${minutes}m-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-full flex flex-col font-mono text-[11px]">
      <div className="p-3 border-b border-border space-y-2">
        <div className="uppercase tracking-[0.2em] text-muted-foreground">After-action replay</div>
        <div className="flex flex-wrap gap-1">
          {WINDOWS.map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              className={`px-2 py-1 border ${
                minutes === m ? "border-cyan text-cyan" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {m >= 60 ? `${m / 60}h` : `${m}m`}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 border border-cyan text-cyan py-1.5 uppercase tracking-[0.16em] hover:bg-cyan/10 disabled:opacity-40"
          >
            {mutation.isPending ? "Reconstructing…" : "Reconstruct window"}
          </button>
          {items && items.length > 0 && (
            <button
              onClick={exportJson}
              className="px-3 border border-border text-muted-foreground uppercase tracking-[0.16em] hover:text-foreground"
            >
              Export
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!items && <p className="text-muted-foreground">Select a window and reconstruct the timeline.</p>}
        {items && items.length === 0 && (
          <p className="text-muted-foreground">No stored events in this window.</p>
        )}
        {items?.map((it, i) => (
          <div key={i} className="border-l-2 border-border pl-3 py-1 relative">
            <span
              className={`absolute -left-[5px] top-2 w-2 h-2 rounded-full ${
                it.kind === "TASKING" ? "bg-cyan" : (it.level ?? 0) >= 4 ? "bg-destructive" : "bg-warning"
              }`}
            />
            <div className="flex justify-between gap-2">
              <span className="text-foreground">{it.title}</span>
              <span className="text-muted-foreground shrink-0">
                {new Date(it.ts).toLocaleTimeString()}
              </span>
            </div>
            <div className="text-muted-foreground leading-relaxed">{it.detail}</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-cyan/70">
              {it.kind} · {it.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
