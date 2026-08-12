// Commander-editable Rules of Engagement.
// Thresholds, auto-execute ceiling and dual-key floor are VERSIONED DATA in the
// database, not constants in code. Publishing is commander-only, re-checked on
// the server, and every publication lands in the tamper-evident journal.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActiveRoe, listRoe, publishRoe } from "@/lib/ops.functions";
import { DEFAULT_ROE, normalizeRoeRow, type RoePolicy } from "@/lib/roe";
import { useOps } from "@/lib/ops-context";

type Row = { key: keyof RoePolicy["thresholds"]; label: string; step: number; max: number };

const SLIDERS: Row[] = [
  { key: "l2", label: "L2 · Monitor at score ≥", step: 0.01, max: 1 },
  { key: "l3", label: "L3 · Engage-auto at score ≥", step: 0.01, max: 1 },
  { key: "l4", label: "L4 · Approve at score ≥", step: 0.01, max: 1 },
  { key: "l5", label: "L5 · Command at score ≥", step: 0.01, max: 1 },
  { key: "low_confidence_below", label: "Low-confidence trigger below", step: 0.01, max: 1 },
];

export function RoePanel() {
  const ops = useOps();
  const qc = useQueryClient();
  const fetchActive = useServerFn(getActiveRoe);
  const fetchAll = useServerFn(listRoe);
  const publish = useServerFn(publishRoe);

  const active = useQuery({ queryKey: ["roe-active"], queryFn: () => fetchActive() });
  const history = useQuery({ queryKey: ["roe-history"], queryFn: () => fetchAll() });

  const current = useMemo(() => normalizeRoeRow(active.data as never), [active.data]);
  const [draft, setDraft] = useState<RoePolicy | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const editing = draft ?? current;
  const isCommander = ops.roles.includes("commander");

  const mutation = useMutation({
    mutationFn: async () =>
      publish({
        data: {
          name: name.trim() || `ROE v${current.version + 1}`,
          thresholds: editing.thresholds,
          autoExecuteCeiling: editing.autoExecuteCeiling,
          dualConfirmFrom: editing.dualConfirmFrom,
          mode: ops.mode,
        },
      }),
    onSuccess: (res) => {
      setMsg(res.ok ? `Published ROE v${res.version}` : res.reason ?? "Denied");
      if (res.ok) {
        setDraft(null);
        setName("");
        void qc.invalidateQueries({ queryKey: ["roe-active"] });
        void qc.invalidateQueries({ queryKey: ["roe-history"] });
      }
    },
    onError: () => setMsg("Server rejected the publication"),
  });

  function patch(p: Partial<RoePolicy>) {
    setDraft({ ...editing, ...p });
  }
  function patchThreshold(k: keyof RoePolicy["thresholds"], v: number) {
    setDraft({ ...editing, thresholds: { ...editing.thresholds, [k]: v } });
  }

  return (
    <div className="h-full overflow-y-auto p-3 space-y-4 font-mono text-[11px]">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="uppercase tracking-[0.2em] text-muted-foreground">Rules of Engagement</span>
          <span className="text-cyan">
            ACTIVE v{current.version} {current.version === 0 && "· FALLBACK"}
          </span>
        </div>
        <p className="text-muted-foreground leading-relaxed">{current.name}</p>
        {!isCommander && (
          <p className="text-warning">Read-only · Commander authority required to publish.</p>
        )}
      </header>

      <section className="space-y-3">
        {SLIDERS.map((s) => (
          <label key={s.key} className="block space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="text-foreground">{(editing.thresholds[s.key] as number).toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={s.max}
              step={s.step}
              disabled={!isCommander}
              value={editing.thresholds[s.key] as number}
              onChange={(e) => patchThreshold(s.key, Number(e.target.value))}
              className="w-full accent-[var(--cyan,#00f0ff)]"
            />
          </label>
        ))}

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Auto-execute ceiling"
            value={editing.autoExecuteCeiling}
            min={0}
            max={5}
            disabled={!isCommander}
            onChange={(v) => patch({ autoExecuteCeiling: v })}
          />
          <NumberField
            label="Dual-key from level"
            value={editing.dualConfirmFrom}
            min={1}
            max={5}
            disabled={!isCommander}
            onChange={(v) => patch({ dualConfirmFrom: v })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="CRITICAL bump"
            value={editing.thresholds.critical_bump}
            min={0}
            max={2}
            disabled={!isCommander}
            onChange={(v) => patchThreshold("critical_bump", v)}
          />
          <NumberField
            label="Low-conf bump"
            value={editing.thresholds.low_confidence_bump}
            min={0}
            max={2}
            disabled={!isCommander}
            onChange={(v) => patchThreshold("low_confidence_bump", v)}
          />
        </div>
      </section>

      {isCommander && (
        <section className="space-y-2 border-t border-border pt-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`ROE v${current.version + 1} name`}
            className="w-full bg-card border border-border px-2 py-1.5 text-foreground outline-none focus:border-cyan"
          />
          <div className="flex gap-2">
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex-1 border border-cyan text-cyan py-1.5 uppercase tracking-[0.16em] hover:bg-cyan/10 disabled:opacity-40"
            >
              {mutation.isPending ? "Publishing…" : "Publish new version"}
            </button>
            <button
              onClick={() => { setDraft(null); setMsg(null); }}
              className="px-3 border border-border text-muted-foreground uppercase tracking-[0.16em] hover:text-foreground"
            >
              Reset
            </button>
          </div>
          <button
            onClick={() => setDraft({ ...DEFAULT_ROE, version: current.version })}
            className="w-full text-left text-muted-foreground hover:text-foreground"
          >
            ↺ load baseline values
          </button>
          {msg && <p className="text-cyan">{msg}</p>}
        </section>
      )}

      <section className="border-t border-border pt-3 space-y-1">
        <div className="uppercase tracking-[0.2em] text-muted-foreground mb-1">Version history</div>
        {(history.data ?? []).map((r) => (
          <div key={r.id} className="flex justify-between border-b border-border/40 py-1">
            <span className={r.active ? "text-cyan" : "text-muted-foreground"}>
              v{r.version} · {r.name}
            </span>
            <span className="text-muted-foreground">
              {new Date(r.created_at).toLocaleTimeString()}
            </span>
          </div>
        ))}
        {(history.data ?? []).length === 0 && (
          <p className="text-muted-foreground">No published versions — built-in baseline in force.</p>
        )}
      </section>
    </div>
  );
}

function NumberField({
  label, value, min, max, disabled, onChange,
}: { label: string; value: number; min: number; max: number; disabled?: boolean; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-muted-foreground block">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-card border border-border px-2 py-1 text-foreground outline-none focus:border-cyan disabled:opacity-50"
      />
    </label>
  );
}
