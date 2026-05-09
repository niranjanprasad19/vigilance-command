import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? "bg-background/70 backdrop-blur-xl border-b border-border" : "bg-transparent"}`}>
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative w-7 h-7">
            <div className="absolute inset-0 border border-cyan rotate-45" />
            <div className="absolute inset-1.5 bg-cyan rotate-45 group-hover:scale-110 transition-transform" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">VIGILANCE</span>
          <span className="font-mono text-[10px] text-muted-foreground border border-border px-1.5 py-0.5 ml-1">v2.4</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 font-mono text-xs uppercase tracking-wider">
          <a href="#capabilities" className="text-muted-foreground hover:text-cyan transition">Capabilities</a>
          <a href="#architecture" className="text-muted-foreground hover:text-cyan transition">System</a>
          <a href="#workflow" className="text-muted-foreground hover:text-cyan transition">Workflow</a>
          <a href="#faq" className="text-muted-foreground hover:text-cyan transition">FAQ</a>
        </nav>
        <Link to="/dashboard" className="group relative font-mono text-xs uppercase tracking-wider px-4 py-2 border border-cyan text-cyan hover:bg-cyan hover:text-primary-foreground transition-colors">
          Launch Console
          <span className="ml-2">→</span>
        </Link>
      </div>
    </header>
  );
}
