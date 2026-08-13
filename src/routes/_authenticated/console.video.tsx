import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PagePanel } from "@/components/dashboard/PagePanel";
import { VideoWall } from "@/components/dashboard/VideoWall";
import { EntityDetail } from "@/components/dashboard/EntityDetail";
import type { Entity } from "@/lib/telemetry";

export const Route = createFileRoute("/_authenticated/console/video")({
  head: () => ({
    meta: [
      { title: "Multi-Spectral Video Wall · Vigilance" },
      { name: "description", content: "EO, IR, night-vision and SAR feeds with live detection overlays." },
      { property: "og:title", content: "Multi-Spectral Video Wall · Vigilance" },
      { property: "og:description", content: "EO, IR, night-vision and SAR feeds with live detection overlays." },
    ],
  }),
  component: VideoPage,
});

function VideoPage() {
  const [selected, setSelected] = useState<Entity | null>(null);
  return (
    <PagePanel title="Video Wall" subtitle="EO · IR · NV · SAR">
      <VideoWall selectedEntity={selected} onSelectEntity={setSelected} />
      <div className="border-t border-border">
        <EntityDetail entity={selected} />
      </div>
    </PagePanel>
  );
}
