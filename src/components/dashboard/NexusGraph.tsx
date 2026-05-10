import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ZoomIn, ZoomOut, Maximize2, Crosshair } from "lucide-react";
import { scenario, getBus, type Edge, type Entity, type GhostTrack } from "@/lib/telemetry";

type GNode = Entity & { x?: number; y?: number; vx?: number; vy?: number };
type GLink = { source: GNode | string; target: GNode | string; rel: Edge["rel"]; confidence: number };

const KIND_COLOR: Record<Entity["kind"], string> = {
  sector: "#1f2d3d",
  vehicle: "#5fd1ff",
  person: "#9ec5e6",
  drone: "#3ee2ff",
  structure: "#7a8fa3",
  signal: "#ffb86b",
  vessel: "#5fd1ff",
  "uav-hostile": "#ff4d5e",
};

const REL_STYLE: Record<Edge["rel"], { color: string; dash: number[] | null }> = {
  controls:      { color: "rgba(62,226,255,0.55)",  dash: null },
  operates:      { color: "rgba(158,197,230,0.45)", dash: null },
  communicates:  { color: "rgba(255,184,107,0.55)", dash: [4, 3] },
  transports:    { color: "rgba(120,200,160,0.45)", dash: null },
  "located-in":  { color: "rgba(120,140,160,0.18)", dash: null },
  tracks:        { color: "rgba(255,77,94,0.55)",   dash: [2, 3] },
};

const KIND_LABELS: Record<Entity["kind"], string> = {
  sector: "Sector", vehicle: "Vehicle", person: "Personnel", drone: "UAV",
  structure: "Outpost", signal: "Signal", vessel: "Vessel", "uav-hostile": "Hostile",
};

interface Props {
  onSelect?: (entity: Entity | null) => void;
  selectedId?: string | null;
}

// Draw kind-specific glyph centred on node
function drawGlyph(node: GNode, ctx: CanvasRenderingContext2D, scale: number, dim: boolean) {
  const x = node.x!, y = node.y!;
  const color = KIND_COLOR[node.kind];
  ctx.globalAlpha = dim ? 0.18 : 1;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4 / scale;

  switch (node.kind) {
    case "sector": {
      ctx.globalAlpha = dim ? 0.08 : 0.22;
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = dim ? 0.18 : 0.6;
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case "drone": {
      // Triangle (UAV)
      ctx.beginPath();
      ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y + 5); ctx.lineTo(x - 6, y + 5);
      ctx.closePath(); ctx.fill();
      break;
    }
    case "vehicle": {
      // Square
      ctx.fillRect(x - 5, y - 5, 10, 10);
      break;
    }
    case "person": {
      // Circle
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "structure": {
      // Hexagon (outpost)
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        const px = x + Math.cos(a) * 6, py = y + Math.sin(a) * 6;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
    case "vessel": {
      // Elongated diamond
      ctx.beginPath();
      ctx.moveTo(x, y - 4); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 8, y);
      ctx.closePath(); ctx.fill();
      break;
    }
    case "signal": {
      // Pulse rings
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = dim ? 0.1 : 0.35;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case "uav-hostile": {
      // Diamond w/ inner X
      ctx.beginPath();
      ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 7, y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#0a0f14";
      ctx.lineWidth = 1.2 / scale;
      ctx.beginPath();
      ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3);
      ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3);
      ctx.stroke();
      break;
    }
  }
  ctx.globalAlpha = 1;
}

export function NexusGraph({ onSelect, selectedId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<{
    zoom: (k?: number, ms?: number) => number;
    zoomToFit: (ms?: number, padding?: number) => void;
    centerAt: (x?: number, y?: number, ms?: number) => void;
  } | null>(null);
  const [Comp, setComp] = useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<Set<Entity["kind"]>>(new Set());
  const [ghostTracks, setGhostTracks] = useState<Map<string, GhostTrack>>(new Map());
  const [data, setData] = useState<{ nodes: GNode[]; links: GLink[] }>(() => ({
    nodes: scenario.entities.map((e) => ({ ...e })),
    links: scenario.edges.map((e) => ({ source: e.source, target: e.target, rel: e.rel, confidence: e.confidence })),
  }));

  // Adjacency for highlighting
  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    data.links.forEach((l) => {
      const s = typeof l.source === "string" ? l.source : l.source.id;
      const t = typeof l.target === "string" ? l.target : l.target.id;
      if (!map.has(s)) map.set(s, new Set());
      if (!map.has(t)) map.set(t, new Set());
      map.get(s)!.add(t); map.get(t)!.add(s);
    });
    return map;
  }, [data.links]);

  const neighborSet = useMemo(() => {
    if (!selectedId) return null;
    const n = new Set<string>([selectedId]);
    adjacency.get(selectedId)?.forEach((id) => n.add(id));
    return n;
  }, [selectedId, adjacency]);

  const matchSet = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && kindFilter.size === 0) return null;
    const set = new Set<string>();
    data.nodes.forEach((n) => {
      const kindOk = kindFilter.size === 0 || kindFilter.has(n.kind);
      const qOk = !q || n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q);
      if (kindOk && qOk) set.add(n.id);
    });
    return set;
  }, [query, kindFilter, data.nodes]);

  useEffect(() => {
    let cancelled = false;
    import("react-force-graph-2d").then((m) => {
      if (!cancelled) setComp(() => m.default as React.ComponentType<Record<string, unknown>>);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const bus = getBus();
    const offThr = bus.on("threat:event", (t) => {
      setData((d) => ({
        ...d,
        nodes: d.nodes.map((n) =>
          n.id === t.entityId
            ? { ...n, threat: Math.min(1, (n.threat ?? 0) + (t.severity === "CRITICAL" ? 0.08 : 0.03)) }
            : n,
        ),
      }));
    });
    const offGT = bus.on("ghost-track", (g) => {
      setGhostTracks((m) => {
        const next = new Map(m); next.set(g.entityId, g); return next;
      });
      // Auto-expire after horizon
      setTimeout(() => {
        setGhostTracks((m) => {
          const next = new Map(m);
          if (next.get(g.entityId)?.id === g.id) next.delete(g.entityId);
          return next;
        });
      }, g.horizonSec * 1000);
    });
    return () => { offThr(); offGT(); };
  }, []);

  // Minimap renderer
  useEffect(() => {
    const cv = minimapRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const W = cv.width, H = cv.height;
    let raf = 0;
    const render = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(10,15,20,0.85)";
      ctx.fillRect(0, 0, W, H);
      const pts = data.nodes.filter((n) => typeof n.x === "number");
      if (pts.length) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        pts.forEach((n) => {
          minX = Math.min(minX, n.x!); minY = Math.min(minY, n.y!);
          maxX = Math.max(maxX, n.x!); maxY = Math.max(maxY, n.y!);
        });
        const pad = 8;
        const sx = (W - pad * 2) / Math.max(1, maxX - minX);
        const sy = (H - pad * 2) / Math.max(1, maxY - minY);
        const s = Math.min(sx, sy);
        pts.forEach((n) => {
          const x = pad + (n.x! - minX) * s;
          const y = pad + (n.y! - minY) * s;
          ctx.fillStyle = n.id === selectedId ? "#3ee2ff" : (n.threat ?? 0) > 0.5 ? "#ff4d5e" : KIND_COLOR[n.kind];
          ctx.fillRect(x - 1, y - 1, 2, 2);
        });
      }
      ctx.strokeStyle = "rgba(62,226,255,0.4)";
      ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [data.nodes, selectedId]);

  const allKinds: Entity["kind"][] = ["drone", "vehicle", "person", "structure", "vessel", "signal", "uav-hostile"];

  const toggleKind = (k: Entity["kind"]) => {
    setKindFilter((s) => {
      const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n;
    });
  };

  const isDimmed = (id: string) => {
    if (matchSet && !matchSet.has(id)) return true;
    if (neighborSet && !neighborSet.has(id)) return true;
    return false;
  };

  const nodeCanvas = (node: GNode, ctx: CanvasRenderingContext2D, scale: number) => {
    const dim = isDimmed(node.id);
    const isSel = node.id === selectedId;

    // Threat halo
    if ((node.threat ?? 0) > 0.4 && node.kind !== "sector" && !dim) {
      const pulse = 0.6 + Math.sin(Date.now() / 300) * 0.2;
      ctx.strokeStyle = `rgba(255,77,94,${pulse * 0.7})`;
      ctx.lineWidth = 1.2 / scale;
      ctx.beginPath(); ctx.arc(node.x!, node.y!, 10, 0, Math.PI * 2); ctx.stroke();
    }

    drawGlyph(node, ctx, scale, dim);

    // Ghost track projection
    const gt = ghostTracks.get(node.id);
    if (gt && !dim && typeof node.x === "number") {
      const len = Math.min(60, gt.speedKts * 0.5);
      const rad = (gt.bearing - 90) * Math.PI / 180;
      const ex = node.x! + Math.cos(rad) * len;
      const ey = node.y! + Math.sin(rad) * len;
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = `rgba(62,226,255,${0.4 + gt.confidence * 0.5})`;
      ctx.lineWidth = 1.2 / scale;
      ctx.beginPath(); ctx.moveTo(node.x!, node.y!); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.setLineDash([]);
      // Arrowhead
      ctx.fillStyle = "rgba(62,226,255,0.8)";
      ctx.beginPath();
      ctx.arc(ex, ey, 2.2 / scale + 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    if (isSel) {
      ctx.strokeStyle = "#3ee2ff";
      ctx.lineWidth = 1.6 / scale;
      ctx.beginPath(); ctx.arc(node.x!, node.y!, 13, 0, Math.PI * 2); ctx.stroke();
    }

    if ((scale > 1.3 || node.kind === "sector" || isSel) && !dim) {
      ctx.fillStyle = isSel ? "#3ee2ff" : "#cfd8e3";
      ctx.font = `${node.kind === "sector" ? 11 : 9}px JetBrains Mono`;
      ctx.textAlign = "center";
      ctx.fillText(node.label, node.x!, node.y! + 18);
    }
  };

  const linkCanvas = (link: GLink, ctx: CanvasRenderingContext2D, scale: number) => {
    const s = link.source as GNode, t = link.target as GNode;
    if (typeof s.x !== "number" || typeof t.x !== "number") return;
    const sId = s.id, tId = t.id;
    const dim = (neighborSet && !(neighborSet.has(sId) && neighborSet.has(tId))) ||
                (matchSet && !(matchSet.has(sId) || matchSet.has(tId)));
    const style = REL_STYLE[link.rel];
    ctx.save();
    ctx.strokeStyle = style.color;
    ctx.globalAlpha = dim ? 0.08 : 1;
    ctx.lineWidth = (0.4 + link.confidence * 1.6) / scale;
    if (style.dash) ctx.setLineDash(style.dash.map((d) => d / scale));
    ctx.beginPath(); ctx.moveTo(s.x, s.y!); ctx.lineTo(t.x, t.y!); ctx.stroke();
    ctx.restore();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-background overflow-hidden">
      {/* Top-left label */}
      <div className="absolute top-3 left-3 z-10 font-mono text-[10px] uppercase tracking-wider text-muted-foreground pointer-events-none">
        Nexus Graph · {data.nodes.length} entities · {data.links.length} edges
        {ghostTracks.size > 0 && <span className="ml-2 text-cyan">· {ghostTracks.size} ghost-tracks</span>}
      </div>

      {/* Search + filter */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 bg-background/80 backdrop-blur border border-border px-2 py-1">
          <Search className="w-3 h-3 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search entities…"
            className="bg-transparent text-[11px] font-mono outline-none w-32 placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="flex flex-wrap gap-1 justify-end max-w-[260px]">
          {allKinds.map((k) => {
            const active = kindFilter.has(k);
            return (
              <button
                key={k}
                onClick={() => toggleKind(k)}
                className={`px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider border transition-colors ${
                  active
                    ? "border-cyan text-cyan bg-cyan/10"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
                style={active ? {} : { borderLeft: `2px solid ${KIND_COLOR[k]}` }}
              >
                {KIND_LABELS[k]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1">
        <button
          aria-label="Zoom in"
          onClick={() => fgRef.current?.zoom((fgRef.current.zoom() ?? 1) * 1.4, 250)}
          className="w-7 h-7 grid place-items-center bg-background/80 backdrop-blur border border-border hover:border-cyan text-muted-foreground hover:text-cyan transition-colors"
        ><ZoomIn className="w-3.5 h-3.5" /></button>
        <button
          aria-label="Zoom out"
          onClick={() => fgRef.current?.zoom((fgRef.current.zoom() ?? 1) / 1.4, 250)}
          className="w-7 h-7 grid place-items-center bg-background/80 backdrop-blur border border-border hover:border-cyan text-muted-foreground hover:text-cyan transition-colors"
        ><ZoomOut className="w-3.5 h-3.5" /></button>
        <button
          aria-label="Fit"
          onClick={() => fgRef.current?.zoomToFit(400, 40)}
          className="w-7 h-7 grid place-items-center bg-background/80 backdrop-blur border border-border hover:border-cyan text-muted-foreground hover:text-cyan transition-colors"
        ><Maximize2 className="w-3.5 h-3.5" /></button>
        <button
          aria-label="Recenter on selection"
          onClick={() => {
            const n = data.nodes.find((x) => x.id === selectedId);
            if (n && typeof n.x === "number") fgRef.current?.centerAt(n.x, n.y, 400);
          }}
          className="w-7 h-7 grid place-items-center bg-background/80 backdrop-blur border border-border hover:border-cyan text-muted-foreground hover:text-cyan transition-colors disabled:opacity-30"
          disabled={!selectedId}
        ><Crosshair className="w-3.5 h-3.5" /></button>
      </div>

      {/* Minimap */}
      <div className="absolute bottom-3 right-3 z-10 border border-border bg-background/70 backdrop-blur">
        <div className="px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-muted-foreground border-b border-border">
          Minimap
        </div>
        <canvas ref={minimapRef} width={140} height={90} className="block" />
      </div>

      {Comp && (
        <Comp
          ref={fgRef}
          graphData={data}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          nodeCanvasObject={nodeCanvas}
          nodePointerAreaPaint={(node: GNode, color: string, ctx: CanvasRenderingContext2D) => {
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(node.x!, node.y!, 10, 0, Math.PI * 2); ctx.fill();
          }}
          linkCanvasObject={linkCanvas}
          linkCanvasObjectMode={() => "replace"}
          linkDirectionalParticles={(l: GLink) => (l.rel === "tracks" ? 2 : 0)}
          linkDirectionalParticleSpeed={0.005}
          linkDirectionalParticleColor={() => "#3ee2ff"}
          linkDirectionalParticleWidth={1.5}
          cooldownTicks={140}
          warmupTicks={40}
          d3AlphaDecay={0.035}
          d3VelocityDecay={0.35}
          enableNodeDrag={true}
          minZoom={0.4}
          maxZoom={6}
          onNodeClick={(n: GNode) => onSelect?.(n)}
          onBackgroundClick={() => onSelect?.(null)}
        />
      )}
    </div>
  );
}
