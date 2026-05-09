import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { Ticker } from "@/components/site/Ticker";
import { Stats } from "@/components/site/Stats";
import { Capabilities } from "@/components/site/Capabilities";
import { Workflow } from "@/components/site/Workflow";
import { Architecture } from "@/components/site/Architecture";
import { FAQ } from "@/components/site/FAQ";
import { CTA } from "@/components/site/CTA";
import { Footer } from "@/components/site/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vigilance — AI-Powered Command Dashboard for Multi-Domain Operations" },
      { name: "description", content: "Vigilance fuses sensor telemetry, predictive AI, and a living Knowledge Graph into a single tactical command interface for high-stakes operational environments." },
      { property: "og:title", content: "Vigilance — Command the Battlespace" },
      { property: "og:description", content: "See the unseen. Decide in milliseconds. AI-powered multi-domain coordination platform." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main>
        <Hero />
        <Ticker />
        <Stats />
        <Capabilities />
        <Workflow />
        <Architecture />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
