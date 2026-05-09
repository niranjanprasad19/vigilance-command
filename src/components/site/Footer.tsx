export function Footer() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 py-16">
        <div className="grid md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="relative w-7 h-7">
                <div className="absolute inset-0 border border-cyan rotate-45" />
                <div className="absolute inset-1.5 bg-cyan rotate-45" />
              </div>
              <span className="font-display font-bold text-lg">VIGILANCE</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">Autonomous multi-domain coordination for the modern operational frontier.</p>
          </div>
          {[
            { h: "Platform", l: ["Nexus Graph", "Vanguard AI", "Chronos", "Swarm Logic"] },
            { h: "Company", l: ["About", "Field Notes", "Careers", "Press"] },
            { h: "Contact", l: ["Request Briefing", "Partner Program", "Support", "Security"] },
          ].map(c => (
            <div key={c.h}>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan mb-4">{c.h}</div>
              <ul className="space-y-2.5">
                {c.l.map(x => (<li key={x}><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition">{x}</a></li>))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 pt-6 border-t border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <div>© 2026 Vigilance Systems · CAGE 9V8K2 · All rights reserved</div>
          <div className="flex items-center gap-6">
            <span>STATUS · <span className="text-cyan">Operational</span></span>
            <span>BUILD · 2.4.1107</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
