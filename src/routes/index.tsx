import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { EarthControls, FirstUseGuide, SignificanceControls } from "@/components/te/EarthControls";
import { Layers, Scan, PanelLeftOpen, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { LayerPanel } from "@/components/te/LayerPanel";
import { ContextPanel } from "@/components/te/ContextPanel";
import { Timeline } from "@/components/te/Timeline";
import { CommandBar } from "@/components/te/CommandBar";
import { SearchBox } from "@/components/te/SearchBox";
import { Wordmark } from "@/components/te/Logo";
import { runCommand } from "@/lib/ai-agent";
import { cn } from "@/lib/utils";

const EarthGlobe = lazy(() => import("@/components/te/EarthGlobe"));
const EarthMap = lazy(() => import("@/components/te/EarthMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Explore — Third Eye Earth Intelligence" },
      { name: "description", content: "Explore real NASA NISAR acquisition coverage on a 3D Earth, with zoom-aware satellite map labels and a backend-powered assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Third Eye — See. Detect. Understand." },
      { property: "og:description", content: "An Earth-observation explorer with NASA NISAR catalog coverage, satellite imagery, and a backend-powered assistant." },
    ],
  }),
  component: Explore,
});

export function Explore() {
  const earthMode = useApp(s => s.earthMode);
  const [panel, setPanel] = useState<"layers" | "context" | null>(null);
  const [layersCollapsed, setLayersCollapsed] = useState(true);
  const [contextCollapsed, setContextCollapsed] = useState(true);
  const ai = useApp((s) => s.aiActive);
  const filter = useApp((s) => s.filter);
  const setFilter = useApp((s) => s.setFilter);
  return (
    <div className="relative h-full w-full overflow-hidden" >
      <ClientOnly fallback={null}>
        <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center label-xs">Initialising globe…</div>}>
          {earthMode === "3d" ? <EarthGlobe /> : <EarthMap />}
        </Suspense>
      </ClientOnly>

      {/* top bar */}
      <div className="earth-topbar pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 p-4">
        <div className="pointer-events-auto"><Wordmark /></div>
        <div className="earth-search pointer-events-auto flex min-w-0 flex-1 justify-center"><SearchBox /></div>
        <button onClick={() => useApp.getState().setAIActive(!ai)} className={cn("pointer-events-auto glass flex h-9 items-center gap-2 px-3 font-mono text-[11px] tracking-[0.2em]", ai && "glow-cyan text-primary")}>
          <span className={cn("size-2 rounded-full bg-primary", ai && "animate-ai-pulse")} />AI
        </button>
      </div>

      {(filter.types || filter.region) && (
        <div className="absolute left-1/2 top-16 z-20 flex -translate-x-1/2 items-center gap-2 glass px-3 py-1.5 font-mono text-[10px] tracking-wider text-muted-foreground">
          FILTER: {[filter.types?.join(", "), filter.region].filter(Boolean).join(" · ").toUpperCase()}
          <button onClick={() => setFilter({ types: null, region: null })} className="text-primary">CLEAR</button>
        </div>
      )}

      {!layersCollapsed && <div className="desktop-layer-panel absolute bottom-[180px] left-4 top-28 z-10 flex"><LayerPanel onCollapse={() => setLayersCollapsed(true)} /></div>}
      {layersCollapsed && <Button className="desktop-layer-reopen absolute left-4 top-28 z-10 glass" size="sm" variant="outline" onClick={() => setLayersCollapsed(false)} aria-label="Open layers panel"><PanelLeftOpen className="size-4" /> Layers</Button>}
      {!contextCollapsed && <div className="desktop-context-panel absolute bottom-[180px] right-4 top-28 z-10 flex flex-col items-end">
        <Button className="desktop-context-collapse absolute -left-10 top-0" size="icon" variant="outline" onClick={() => setContextCollapsed(true)} aria-label="Collapse details panel" title="Collapse details panel"><X className="size-4" /></Button>
        <ContextPanel />
      </div>}
      {contextCollapsed && <Button className="desktop-context-reopen absolute right-4 top-28 z-10 glass" size="icon" variant="outline" onClick={() => setContextCollapsed(false)} aria-label="Open details panel" title="Open details panel"><Scan className="size-4" /></Button>}

      <EarthControls />
      <SignificanceControls />
      <FirstUseGuide />
      <div className="sample-indicator">REAL NISAR CATALOG FOOTPRINTS · SAMPLE SCIENCE CANDIDATES ARE LABELLED SEPARATELY</div>
      <div className="mobile-panel-controls"><Button size="icon" variant="outline" aria-label="Open layers" onClick={() => setPanel(panel === "layers" ? null : "layers")}><Layers /></Button><Button size="icon" variant="outline" aria-label="Open context" onClick={() => setPanel(panel === "context" ? null : "context")}><Scan /></Button></div>
      {panel && <div className="mobile-earth-panel">{panel === "layers" ? <LayerPanel onCollapse={() => setPanel(null)} /> : <ContextPanel />}</div>}

      <div className="earth-view-dock absolute inset-x-4 bottom-4 z-20 flex flex-col items-center gap-2">
        <CommandBar />
        <div className="w-full"><Timeline /></div>
      </div>
    </div>
  );
}
