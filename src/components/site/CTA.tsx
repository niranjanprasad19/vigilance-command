import { Link } from "@tanstack/react-router";

export function CTA() {
  return (
    <section className="relative py-24 md:py-40 overflow-hidden border-t border-border">
      <div className="absolute inset-0 grid-bg radial-fade opacity-50" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan to-transparent" />
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan mb-8">— Authorized Personnel Only</div>
        <h2 className="font-display text-[clamp(3rem,9vw,9rem)] leading-[0.9] font-bold mb-10">
          Take <span className="text-cyan text-glow-cyan">command.</span>
        </h2>
        <p className="max-w-xl mx-auto text-muted-foreground mb-12">
          Request a classified demonstration with our field engineering team. Deployment briefings within 48 hours.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link to="/dashboard" className="font-mono text-xs uppercase tracking-[0.2em] px-8 py-5 bg-cyan text-primary-foreground hover:bg-cyan/90 transition-all glow-cyan">
            Launch Console →
          </Link>
          <a href="mailto:contact@vigilance.defense" className="font-mono text-xs uppercase tracking-[0.2em] px-8 py-5 border border-border hover:border-cyan hover:text-cyan transition">
            Request Briefing
          </a>
        </div>
      </div>
    </section>
  );
}
