import { motion } from "framer-motion";

const steps = [
  { num: "01", title: "Ingest", body: "Sensor telemetry from drones, radar, thermal, SAR, and IoT pours into the gateway via Kafka and MQTT — millions of events per second." },
  { num: "02", title: "Fuse", body: "The Intelligence Layer aligns every signal in space and time, resolving entities across modalities into a single ontology." },
  { num: "03", title: "Predict", body: "Vision, prediction, and swarm models score anomalies and forecast trajectories before threats materialize." },
  { num: "04", title: "Decide", body: "Operators command the response in natural language. Vanguard AI executes — tasking drones, alerting teams, locking sectors." },
];

export function Workflow() {
  return (
    <section id="workflow" className="relative py-24 md:py-40 border-t border-border bg-card/40">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan mb-6">— 03 / Operational Workflow</div>
        <h2 className="font-display text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.95] font-bold max-w-[14ch] mb-20">
          From raw signal to <span className="text-cyan">commanded action.</span>
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.12 }}
              className="bg-background p-8 md:p-10 relative group min-h-[280px] flex flex-col"
            >
              <div className="font-mono text-xs text-cyan mb-6 flex items-center gap-3">
                <span>{s.num}</span>
                <span className="flex-1 h-px bg-border group-hover:bg-cyan transition-colors" />
              </div>
              <h3 className="font-display text-3xl font-bold mb-4">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
