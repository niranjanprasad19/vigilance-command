import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, Crosshair } from "lucide-react";
import { getBus, scenario, type Entity, type ThreatEvent } from "@/lib/telemetry";

type Band = "EO" | "IR" | "NV" | "SAR";

interface FeedDef {
  id: string;
  band: Band;
  label: string;
  sector: string;
  callsign: string;
}

const FEEDS: FeedDef[] = [
  { id: "vw:eo", band: "EO", label: "Optical · 4K", sector: "ALPHA-7", callsign: "VG-01" },
  { id: "vw:ir", band: "IR", label: "Thermal · MWIR", sector: "BRAVO-2", callsign: "VG-02" },
  { id: "vw:nv", band: "NV", label: "Night Vision · I²", sector: "CHARLIE-9", callsign: "VG-03" },
  { id: "vw:sar", band: "SAR", label: "Synthetic Aperture", sector: "DELTA-1", callsign: "VG-04" },
];

interface DetectionBox {
  id: string;
  feedId: string;
  entityId: string;
  label: string;
  x: number; // 0..1
  y: number;
  w: number;
  h: number;
  conf: number;
  severity: ThreatEvent["severity"];
  bornAt: number;
}

interface Props {
  selectedEntity: Entity | null;
  onSelectEntity?: (e: Entity | null) => void;
}

export function VideoWall({ selectedEntity, onSelectEntity }: Props) {
  const [boxes, setBoxes] = useState<DetectionBox[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Generate detection boxes from incoming threat events
  useEffect(() => {
    const bus = getBus();
    const off = bus.on("threat:event", (t) => {
      if (t.predicted) return;
      const ent = scenario.entities.find((e) => e.id === t.entityId);
      if (!ent) return;
      // Pick 1-2 feeds to show this detection on (deterministic-ish)
      const seedNum =
        Math.abs([...t.entityId].reduce((a, c) => a + c.charCodeAt(0), 0)) % FEEDS.length;
      const target = FEEDS[seedNum];
      const box: DetectionBox = {
        id: `${t.id}-${target.id}`,
        feedId: target.id,
        entityId: t.entityId,
        label: ent.label,
        x: 0.15 + Math.random() * 0.55,
        y: 0.18 + Math.random() * 0.5,
        w: 0.1 + Math.random() * 0.18,
        h: 0.12 + Math.random() * 0.16,
        conf: t.confidence,
        severity: t.severity,
        bornAt: Date.now(),
      };
      setBoxes((cur) => [...cur.filter((b) => Date.now() - b.bornAt < 9000), box].slice(-24));
    });
    return off;
  }, []);

  // Cleanup expired boxes
  useEffect(() => {
    const i = setInterval(() => {
      setBoxes((cur) => cur.filter((b) => Date.now() - b.bornAt < 9000));
    }, 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="bg-card border-y border-border">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <Crosshair className="w-3 h-3 text-cyan" />
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Multi-Spectral Video Wall
          </div>
          {selectedEntity && (
            <div className="font-mono text-[10px] text-cyan border border-cyan/40 px-2 py-0.5">
              TRACKING · {selectedEntity.label}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
          <span className="hidden sm:inline">{boxes.length} active detections</span>
          <span className="text-cyan flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-destructive rounded-full pulse-dot" />
            REC
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
        {FEEDS.map((f) => (
          <FeedTile
            key={f.id}
            feed={f}
            boxes={boxes.filter((b) => b.feedId === f.id)}
            highlight={selectedEntity?.id ?? null}
            onExpand={() => setExpanded(f.id)}
            onPickEntity={(eid) => {
              const e = scenario.entities.find((x) => x.id === eid);
              if (e) onSelectEntity?.(e);
            }}
          />
        ))}
      </div>

      {expanded && (
        <FullscreenFeed
          feed={FEEDS.find((f) => f.id === expanded)!}
          boxes={boxes.filter((b) => b.feedId === expanded)}
          highlight={selectedEntity?.id ?? null}
          onClose={() => setExpanded(null)}
          onPickEntity={(eid) => {
            const e = scenario.entities.find((x) => x.id === eid);
            if (e) onSelectEntity?.(e);
          }}
        />
      )}
    </div>
  );
}

// ───────────── Feed tile ─────────────

function FeedTile({
  feed,
  boxes,
  highlight,
  onExpand,
  onPickEntity,
}: {
  feed: FeedDef;
  boxes: DetectionBox[];
  highlight: string | null;
  onExpand: () => void;
  onPickEntity: (id: string) => void;
}) {
  return (
    <div className="relative bg-background aspect-video overflow-hidden group hud-in bezel">
      <SyntheticFeed band={feed.band} />
      <div className="absolute inset-0 crt pointer-events-none" />
      <BoundingBoxes boxes={boxes} highlight={highlight} onPick={onPickEntity} />
      <FeedChrome feed={feed} compact />
      <button
        onClick={onExpand}
        className="absolute top-2 right-2 z-20 p-1.5 bg-background/70 border border-border hover:border-cyan text-muted-foreground hover:text-cyan transition opacity-0 group-hover:opacity-100"
        aria-label="Expand feed"
      >
        <Maximize2 className="w-3 h-3" />
      </button>
    </div>
  );
}

function FullscreenFeed({
  feed,
  boxes,
  highlight,
  onClose,
  onPickEntity,
}: {
  feed: FeedDef;
  boxes: DetectionBox[];
  highlight: string | null;
  onClose: () => void;
  onPickEntity: (id: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 hud-in">
      <div className="relative w-full max-w-6xl aspect-video bg-background border border-cyan/40 bezel">
        <span className="tr" />
        <span className="bl" />
        <SyntheticFeed band={feed.band} />
        <div className="absolute inset-0 crt pointer-events-none noise" />
        <BoundingBoxes boxes={boxes} highlight={highlight} onPick={onPickEntity} large />
        <FeedChrome feed={feed} />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 bg-background/70 border border-cyan text-cyan hover:bg-cyan hover:text-primary-foreground transition"
          aria-label="Close"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
        <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>ESC to exit · {boxes.length} live detections</span>
          <span className="text-cyan">{feed.callsign} · {feed.sector}</span>
        </div>
      </div>
    </div>
  );
}

function FeedChrome({ feed, compact }: { feed: FeedDef; compact?: boolean }) {
  const [time, setTime] = useState(() => new Date().toISOString().substring(11, 19));
  useEffect(() => {
    const i = setInterval(() => setTime(new Date().toISOString().substring(11, 19)), 1000);
    return () => clearInterval(i);
  }, []);
  return (
    <>
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-0.5 font-mono text-[9px] uppercase tracking-wider">
        <div className="flex items-center gap-1.5 text-cyan">
          <span className="w-1 h-1 bg-destructive rounded-full pulse-dot" />
          {feed.band}
          {!compact && <span className="text-muted-foreground"> · {feed.label}</span>}
        </div>
        <div className="text-muted-foreground">{feed.callsign}</div>
      </div>
      <div className="absolute bottom-2 left-2 z-10 font-mono text-[9px] text-muted-foreground">
        {feed.sector} · {time}Z
      </div>
      {/* corner reticles */}
      <div className="absolute inset-3 pointer-events-none z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-cyan/30 reticle" style={{ borderRadius: 999 }}>
          <div className="absolute inset-0 border-t border-cyan/40" style={{ transform: "translateY(15px)" }} />
        </div>
      </div>
    </>
  );
}

function BoundingBoxes({
  boxes,
  highlight,
  onPick,
  large,
}: {
  boxes: DetectionBox[];
  highlight: string | null;
  onPick: (id: string) => void;
  large?: boolean;
}) {
  return (
    <div className="absolute inset-0 z-10">
      {boxes.map((b) => {
        const isHi = b.entityId === highlight;
        const color =
          b.severity === "CRITICAL"
            ? "var(--destructive)"
            : b.severity === "WARN"
              ? "var(--warning)"
              : "var(--cyan)";
        return (
          <button
            key={b.id}
            onClick={() => onPick(b.entityId)}
            className="absolute bbox-pulse focus-cyan"
            style={{
              left: `${b.x * 100}%`,
              top: `${b.y * 100}%`,
              width: `${b.w * 100}%`,
              height: `${b.h * 100}%`,
              border: `1px solid ${color}`,
              boxShadow: isHi ? `0 0 0 1px ${color}, 0 0 14px -2px ${color}` : `0 0 6px -2px ${color}`,
              background: isHi ? "color-mix(in oklab, var(--cyan) 12%, transparent)" : "transparent",
            }}
          >
            <span className="absolute -top-3.5 left-0 font-mono text-[9px] whitespace-nowrap" style={{ color }}>
              {b.label} · {(b.conf * 100).toFixed(0)}%
            </span>
            {large && (
              <>
                <span className="absolute -left-2 top-1/2 w-1.5 h-px" style={{ background: color }} />
                <span className="absolute -right-2 top-1/2 w-1.5 h-px" style={{ background: color }} />
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ───────────── Synthetic spectral feed (canvas) ─────────────

function SyntheticFeed({ band }: { band: Band }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const palette = useMemo(() => {
    switch (band) {
      case "EO":
        return { bg: "#0b1419", fg: "#a4c0d4", accent: "#cfe5f6" };
      case "IR":
        return { bg: "#0a0204", fg: "#ff6a3d", accent: "#ffd66b" };
      case "NV":
        return { bg: "#02110a", fg: "#3fff9a", accent: "#bdffd6" };
      case "SAR":
        return { bg: "#0c0c10", fg: "#7e8aa0", accent: "#cfd6e4" };
    }
  }, [band]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(160, Math.floor(r.width));
      canvas.height = Math.max(90, Math.floor(r.height));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let t = 0;
    const blobs = Array.from({ length: 7 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.05 + Math.random() * 0.18,
      vx: (Math.random() - 0.5) * 0.0008,
      vy: (Math.random() - 0.5) * 0.0008,
      i: Math.random(),
    }));

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, W, H);

      // Terrain / heat blobs
      for (const b of blobs) {
        b.x += b.vx; b.y += b.vy;
        if (b.x < 0 || b.x > 1) b.vx *= -1;
        if (b.y < 0 || b.y > 1) b.vy *= -1;
        const g = ctx.createRadialGradient(b.x * W, b.y * H, 0, b.x * W, b.y * H, b.r * Math.max(W, H));
        const intensity = 0.35 + 0.4 * Math.sin(t * 0.001 + b.i * 6.28);
        g.addColorStop(0, hexA(palette.fg, intensity * 0.9));
        g.addColorStop(0.4, hexA(palette.fg, intensity * 0.35));
        g.addColorStop(1, hexA(palette.fg, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // Band-specific overlay
      if (band === "SAR") {
        // sweeping radar arc
        const cx = W * 0.5, cy = H * 0.55;
        const angle = (t * 0.0015) % (Math.PI * 2);
        const grad = ctx.createConicGradient(angle, cx, cy);
        grad.addColorStop(0, hexA(palette.accent, 0.35));
        grad.addColorStop(0.05, hexA(palette.accent, 0));
        grad.addColorStop(1, hexA(palette.accent, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(W, H) * 0.7, 0, Math.PI * 2);
        ctx.fill();
        // grid rings
        ctx.strokeStyle = hexA(palette.fg, 0.18);
        ctx.lineWidth = 1;
        for (let r = 30; r < Math.max(W, H); r += 40) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (band === "NV") {
        // grain
        const img = ctx.getImageData(0, 0, W, H);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const n = (Math.random() - 0.5) * 30;
          d[i] = Math.max(0, d[i] + n * 0.2);
          d[i + 1] = Math.max(0, d[i + 1] + n);
          d[i + 2] = Math.max(0, d[i + 2] + n * 0.3);
        }
        ctx.putImageData(img, 0, 0);
      } else if (band === "IR") {
        // hot-spot glow
        const cx = W * (0.4 + 0.1 * Math.sin(t * 0.0006));
        const cy = H * (0.5 + 0.1 * Math.cos(t * 0.0008));
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.35);
        g.addColorStop(0, hexA(palette.accent, 0.8));
        g.addColorStop(1, hexA(palette.accent, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      } else {
        // EO subtle parallax horizon
        ctx.strokeStyle = hexA(palette.fg, 0.18);
        ctx.beginPath();
        ctx.moveTo(0, H * 0.62);
        for (let x = 0; x <= W; x += 8) {
          ctx.lineTo(x, H * 0.62 + Math.sin(x * 0.04 + t * 0.002) * 4);
        }
        ctx.stroke();
      }

      t += 16;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [band, palette]);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full block" />;
}

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}
