import { useEffect, useRef, useState } from "react";
import { scenario, getBus, type Edge, type Entity } from "@/lib/telemetry";

type GNode = Entity & { x?: number; y?: number; vx?: number; vy?: number };
type GLink = { source: GNode | string; target: GNode | string; rel: Edge["rel"]; confidence: number };

const KIND_COLOR: Record<Entity["kind"], string> = {
  sector: "#2a3a4a",
  vehicle: "#5fd1ff",
  person: "#9ec5e6",
  drone: "#3ee2ff",
  structure: "#7a8fa3",
  signal: "#ffb86b",
  vessel: "#5fd1ff",
  "uav-hostile": "#ff4d5e",
};

interface Props {
  onSelect?: (entity: Entity | null) => void;
  selectedId?: string | null;
}

export function NexusGraph({ onSelect, selectedId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<unknown>(null);
  const [Comp, setComp] = useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [data, setData] = useState<{ nodes: GNode[]; links: GLink[] }>(() => ({
    nodes: scenario.entities.map((e) => ({ ...e })),
    links: scenario.edges.map((e) => ({ source: e.source, target: e.target, rel: e.rel, confidence: e.confidence })),
  }));

  useEffect(() => {
    let cancelled = false;
    import("react-force-graph-2d").then((m) => {
      if (!cancelled) setComp(() => m.default as React.ComponentType<Record<string, unknown>>);
    });
    return () => {
      cancelled = true;
    };
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

  // Live entity updates from telemetry bus
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
    return () => offThr();
  }, []);

  const nodeCanvas = (node: GNode, ctx: CanvasRenderingContext2D, scale: number) => {
    const r = node.kind === "sector" ? 12 : node.kind === "uav-hostile" ? 7 : 5;
    const isSel = node.id === selectedId;
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
    ctx.fillStyle = KIND_COLOR[node.kind];
    ctx.globalAlpha = node.kind === "sector" ? 0.25 : 0.95;
    ctx.fill();
    ctx.globalAlpha = 1;

    if ((node.threat ?? 0) > 0.4 && node.kind !== "sector") {
      ctx.strokeStyle = "#ff4d5e";
      ctx.lineWidth = 1.5 / scale;
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, r + 4, 0, 2 * Math.PI);
      ctx.stroke();
    }
    if (isSel) {
      ctx.strokeStyle = "#3ee2ff";
      ctx.lineWidth = 2 / scale;
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, r + 7, 0, 2 * Math.PI);
      ctx.stroke();
    }
    if (scale > 1.2 || node.kind === "sector") {
      ctx.fillStyle = "#cfd8e3";
      ctx.font = `${node.kind === "sector" ? 11 : 9}px JetBrains Mono`;
      ctx.textAlign = "center";
      ctx.fillText(node.label, node.x!, node.y! + r + 11);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-background overflow-hidden">
      <div className="absolute top-3 left-3 z-10 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Nexus Graph · {data.nodes.length} entities · {data.links.length} edges
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
            ctx.beginPath();
            ctx.arc(node.x!, node.y!, 10, 0, 2 * Math.PI);
            ctx.fill();
          }}
          linkColor={(l: GLink) => (l.rel === "tracks" ? "rgba(62,226,255,0.4)" : "rgba(120,140,160,0.18)")}
          linkWidth={(l: GLink) => 0.3 + l.confidence * 1.2}
          linkDirectionalParticles={(l: GLink) => (l.rel === "tracks" || l.rel === "communicates" ? 2 : 0)}
          linkDirectionalParticleSpeed={0.006}
          linkDirectionalParticleColor={() => "#3ee2ff"}
          cooldownTicks={120}
          onNodeClick={(n: GNode) => onSelect?.(n)}
          onBackgroundClick={() => onSelect?.(null)}
        />
      )}
    </div>
  );
}
