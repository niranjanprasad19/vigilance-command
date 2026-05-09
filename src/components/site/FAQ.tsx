import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";

const faqs = [
  { q: "Where can Vigilance be deployed?", a: "On-premises, in a sovereign cloud, or as a tactical edge appliance. The full stack is containerized and operates fully air-gapped when required." },
  { q: "What sensors and feeds does it ingest?", a: "Optical, thermal, IR, SAR, LiDAR, ground radar, RF SIGINT, IoT perimeter, and any system exposing Kafka, MQTT, RTSP, or REST. Custom connectors ship in days, not months." },
  { q: "How does the AI copilot stay accurate?", a: "Vanguard runs a retrieval-augmented Llama 3 grounded against the live Neo4j ontology and TimescaleDB telemetry — it cites every claim back to a source entity or sensor reading." },
  { q: "Is it compliant for defense and government use?", a: "Vigilance follows DoD STIG hardening, FIPS 140-3 cryptography, and CMMC L3 controls. Audit logs are immutable and exportable." },
  { q: "Can operators task drones directly from the dashboard?", a: "Yes — through the Swarm Logic service. Tasking can be manual, suggested by Vanguard, or fully autonomous within mission-defined rules of engagement." },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative py-24 md:py-40 border-t border-border">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan mb-6">— 05 / Field Inquiries</div>
        <h2 className="font-display text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.95] font-bold mb-16 max-w-[14ch]">
          Briefing <span className="text-cyan">debrief.</span>
        </h2>
        <div className="max-w-3xl">
          {faqs.map((f, i) => (
            <div key={f.q} className="border-t border-border last:border-b">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between gap-6 py-6 text-left group">
                <span className="font-display text-xl md:text-2xl font-medium group-hover:text-cyan transition-colors">{f.q}</span>
                <Plus className={`w-5 h-5 text-cyan shrink-0 transition-transform duration-300 ${open === i ? "rotate-45" : ""}`} />
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                    <p className="pb-6 text-muted-foreground leading-relaxed max-w-2xl">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
