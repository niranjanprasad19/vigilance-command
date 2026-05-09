import { motion } from "framer-motion";
import heroImg from "@/assets/hero-vigilance.jpg";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-end overflow-hidden pt-16">
      <div className="absolute inset-0">
        <img src={heroImg} alt="Vigilance command center overlooking border terrain at dusk" className="w-full h-full object-cover opacity-70" width={1920} height={1088} />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />
        <div className="absolute inset-0 grid-bg opacity-40 radial-fade" />
      </div>

      {/* Corner crosshairs */}
      <CornerMarks />

      <div className="relative z-10 w-full max-w-[1600px] mx-auto px-6 md:px-10 pb-20 md:pb-32">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="flex items-center gap-3 mb-6 font-mono text-[11px] uppercase tracking-[0.2em] text-cyan">
          <span className="w-2 h-2 bg-cyan rounded-full pulse-dot" />
          System Online · 2026.05.09 · 04:28:11 UTC
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.1 }} className="font-display text-[clamp(3rem,9vw,9rem)] leading-[0.92] font-bold max-w-[18ch]">
          See the <span className="text-cyan text-glow-cyan">unseen.</span>
          <br />Decide in <span className="text-cyan text-glow-cyan">milliseconds.</span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="mt-8 max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed">
          Vigilance is an AI-powered command dashboard that fuses sensor telemetry, predictive threat modeling, and a living Knowledge Graph of the battlespace into a single tactical interface.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6 }} className="mt-10 flex flex-wrap items-center gap-4">
          <a href="#capabilities" className="group relative font-mono text-xs uppercase tracking-[0.2em] px-6 py-4 bg-cyan text-primary-foreground hover:bg-cyan/90 transition-all glow-cyan">
            Initialize Briefing
            <span className="ml-3">→</span>
          </a>
          <a href="#architecture" className="font-mono text-xs uppercase tracking-[0.2em] px-6 py-4 border border-border text-foreground hover:border-cyan hover:text-cyan transition">
            View Architecture
          </a>
        </motion.div>
      </div>

      {/* Bottom HUD bar */}
      <div className="absolute bottom-0 inset-x-0 z-10 border-t border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-6 md:px-10 py-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <div className="flex items-center gap-6">
            <span><span className="text-cyan">LAT</span> 32.7157°N</span>
            <span><span className="text-cyan">LON</span> 117.1611°W</span>
            <span className="hidden md:inline"><span className="text-cyan">SECTOR</span> WEST-9</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <span><span className="text-cyan">ASSETS</span> 247</span>
            <span><span className="text-cyan">FEEDS</span> 1,892</span>
            <span className="text-warning">⚠ 3 ALERTS</span>
          </div>
          <span className="text-cyan animate-pulse">↓ SCROLL</span>
        </div>
      </div>
    </section>
  );
}

function CornerMarks() {
  const cls = "absolute w-6 h-6 border-cyan/60";
  return (
    <>
      <div className={`${cls} top-20 left-6 border-l border-t`} />
      <div className={`${cls} top-20 right-6 border-r border-t`} />
      <div className={`${cls} bottom-12 left-6 border-l border-b`} />
      <div className={`${cls} bottom-12 right-6 border-r border-b`} />
    </>
  );
}
