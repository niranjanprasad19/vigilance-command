import { motion } from "framer-motion";
import { Activity, Brain, Eye, GitBranch, Radio, Shield } from "lucide-react";
import nexusImg from "@/assets/nexus-graph.jpg";
import thermalImg from "@/assets/thermal-map.jpg";

const items = [
  { icon: GitBranch, title: "Nexus Graph", desc: "Force-directed entity link analysis maps every actor, vehicle, and signal in your battlespace into one living ontology." },
  { icon: Brain, title: "Vanguard AI", desc: "Conversational operational copilot trained on doctrine. Query the entire dataset in natural language." },
  { icon: Eye, title: "Multi-Spectral Vision", desc: "Real-time optical, thermal, night-vision, and SAR feeds with biometric anomaly overlays." },
  { icon: Activity, title: "Chronos Interface", desc: "Temporal scrubbing for historical tracking and predictive trajectory projection of ghost-tracks." },
  { icon: Radio, title: "Swarm Logic", desc: "Dynamic multi-agent routing for autonomous drone interception and coordinated response." },
  { icon: Shield, title: "Zero-Trust Fabric", desc: "End-to-end encryption with mission-scoped access control and full forensic audit trails." },
];

export function Capabilities() {
  return (
    <section id="capabilities" className="relative py-24 md:py-40">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan mb-6">— 02 / Capabilities</div>
        <h2 className="font-display text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.95] font-bold max-w-[16ch] mb-20">
          A single pane of glass for the <span className="text-cyan">entire battlespace.</span>
        </h2>

        {/* Two-up feature blocks */}
        <div className="grid lg:grid-cols-2 gap-px bg-border mb-px">
          <FeatureBlock img={nexusImg} kicker="Living Ontology" title="The Nexus Graph" body="Every entity — vehicles, personnel, signals, structures — exists as a node. Every interaction becomes an edge. Analysts traverse relationships at the speed of thought." />
          <FeatureBlock img={thermalImg} kicker="Predictive Intelligence" title="Ghost-Track Forecasting" body="Transformer-based trajectory models project where threats will be in the next 30, 60, and 120 seconds — before they appear on any sensor." />
        </div>

        {/* Capability grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border mt-px">
          {items.map((it, i) => (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="bg-background p-8 group hover:bg-card transition-colors relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-px bg-cyan scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500" />
              <it.icon className="w-6 h-6 text-cyan mb-6" strokeWidth={1.5} />
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">0{i + 1}</div>
              <h3 className="font-display text-2xl font-bold mb-3">{it.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{it.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureBlock({ img, kicker, title, body }: { img: string; kicker: string; title: string; body: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="bg-background p-8 md:p-12 group">
      <div className="relative aspect-[16/10] overflow-hidden mb-8 border border-border">
        <img src={img} alt={title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        <div className="absolute top-3 left-3 font-mono text-[10px] uppercase tracking-wider text-cyan flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-cyan rounded-full pulse-dot" />LIVE FEED
        </div>
      </div>
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan mb-3">{kicker}</div>
      <h3 className="font-display text-3xl md:text-4xl font-bold mb-4">{title}</h3>
      <p className="text-muted-foreground leading-relaxed max-w-md">{body}</p>
    </motion.div>
  );
}
