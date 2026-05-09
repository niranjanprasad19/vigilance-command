import { motion } from "framer-motion";

const layers = [
  { name: "Presentation Layer", tech: "React 18 · Vite · TypeScript · Tailwind", role: "Nexus Graph, Chronos timeline, Vanguard copilot, multi-spectral feeds." },
  { name: "Application Layer", tech: "Node.js · Express · Socket.io", role: "Auth, API routing, sub-second telemetry broadcast, ML orchestration." },
  { name: "Intelligence Layer", tech: "Python 3.10 · FastAPI · YOLOv8 · Llama 3", role: "Vision, prediction, RAG copilot, swarm tasking heuristics." },
  { name: "Data Layer", tech: "Neo4j · TimescaleDB · Redis", role: "Entity graph, time-series telemetry, ephemeral session and pub/sub." },
];

export function Architecture() {
  return (
    <section id="architecture" className="relative py-24 md:py-40">
      <div className="absolute inset-0 grid-bg-fine opacity-30 radial-fade" />
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10">
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan mb-6">— 04 / System Architecture</div>
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-16 items-start">
          <div>
            <h2 className="font-display text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] font-bold mb-6">
              Microservices built for <span className="text-cyan">low-latency fusion.</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-md">
              Four layers, one mission. Each service scales independently and fails gracefully — designed for environments where downtime is not an option.
            </p>
            <div className="mt-10 grid grid-cols-3 gap-px bg-border">
              {[
                { l: "RPO", v: "0s" },
                { l: "RTO", v: "<15s" },
                { l: "Uptime", v: "99.99%" },
              ].map(x => (
                <div key={x.l} className="bg-background p-4">
                  <div className="font-display text-2xl font-bold text-cyan">{x.v}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{x.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-px bg-border">
            {layers.map((layer, i) => (
              <motion.div
                key={layer.name}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-background p-6 md:p-8 group hover:bg-card transition-colors relative"
              >
                <div className="flex items-baseline gap-4 mb-2">
                  <span className="font-mono text-xs text-cyan">L{i + 1}</span>
                  <h3 className="font-display text-2xl font-bold">{layer.name}</h3>
                </div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-3 ml-9">{layer.tech}</div>
                <p className="text-sm text-muted-foreground ml-9 max-w-xl">{layer.role}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
