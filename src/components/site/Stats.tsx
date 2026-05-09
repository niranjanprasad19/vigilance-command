import { motion } from "framer-motion";

const stats = [
  { value: "12ms", label: "Sensor-to-Decision Latency", note: "End-to-end fusion" },
  { value: "99.97%", label: "Threat Detection Accuracy", note: "Validated 2026 Q1" },
  { value: "1.2M", label: "Telemetry Events / Second", note: "Per cluster" },
  { value: "247", label: "Concurrent Asset Streams", note: "Multi-spectral" },
];

export function Stats() {
  return (
    <section className="relative border-y border-border bg-card/40">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 py-20 md:py-28">
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan mb-12">— 01 / Operational Metrics</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="bg-background p-6 md:p-10 group hover:bg-card transition-colors"
            >
              <div className="font-display text-5xl md:text-7xl font-bold text-foreground group-hover:text-cyan transition-colors">{s.value}</div>
              <div className="mt-4 text-sm text-foreground">{s.label}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{s.note}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
