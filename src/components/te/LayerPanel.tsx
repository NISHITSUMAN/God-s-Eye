import { useEffect, useState } from "react";
import { ChevronDown, Eye, EyeOff, SlidersHorizontal, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useApp } from "@/lib/store";
import { PHENOMENA } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const NISAR_PRODUCTS = ["RSLC", "RIFG", "RUNW", "ROFF", "GSLC", "GCOV", "GUNW", "GOFF", "SME2"];

function Row({ id, label, swatch, demo, tag, disabled = false, onToggle }: { id: string; label: string; swatch?: string; demo?: boolean; tag?: "LIVE" | "SAMPLE" | "CATALOG"; disabled?: boolean; onToggle?: (enabled: boolean) => void }) {
  const on = useApp((s) => s.layers.has(id));
  const toggle = useApp((s) => s.toggleLayer);
  const opacity = useApp((s) => s.opacity[id] ?? 100);
  const setOpacity = useApp((s) => s.setOpacity);
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className={cn("group flex h-8 items-center gap-2 rounded-md px-2 text-[13px] transition-colors hover:bg-elevated", on ? "text-foreground" : "text-subtle")}>
        <button onClick={() => onToggle ? onToggle(!on) : toggle(id)} disabled={demo || disabled} title={demo ? "This visualization is not connected in the current build." : disabled ? "NISAR catalog is currently loading." : undefined} className="flex flex-1 items-center gap-2.5 text-left disabled:cursor-not-allowed" aria-pressed={on} aria-disabled={demo || disabled || undefined}>
          <span className="size-2 rounded-sm" style={{ background: swatch ?? "var(--primary)", opacity: on ? 1 : 0.3 }} />
          <span className="flex-1">{label}</span>
          {tag && <span className={cn("font-mono text-[9px] tracking-wider", tag === "LIVE" ? "text-ok" : tag === "CATALOG" ? "text-primary" : "text-subtle")}>{tag}</span>}
          {demo && <span className="font-mono text-[9px] tracking-wider text-subtle">DEMO</span>}
        </button>
        <button onClick={() => setOpen(!open)} disabled={demo || disabled} title={demo ? "No settings are available for an unconnected demo layer." : undefined} className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed" aria-label="Layer settings" aria-disabled={demo || disabled || undefined}><SlidersHorizontal className="size-3.5 text-subtle" /></button>
        <button onClick={() => onToggle ? onToggle(!on) : toggle(id)} disabled={demo || disabled} title={demo ? "Visualization not connected." : undefined} aria-label="Toggle visibility" aria-disabled={demo || disabled || undefined}>{on ? <Eye className="size-3.5 text-muted-foreground" /> : <EyeOff className="size-3.5 text-subtle" />}</button>
      </div>
      {open && (
        <div className="flex items-center gap-2 px-2 pb-2 pl-6">
          <span className="label-xs">Opacity</span>
          <input type="range" min={0} max={100} value={opacity} onChange={(e) => setOpacity(id, +e.target.value)} className="h-1 flex-1 accent-[var(--primary)]" />
          <span className="w-8 text-right font-mono text-[10px] text-muted-foreground">{opacity}%</span>
        </div>
      )}
    </div>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border pt-2 first:border-0 first:pt-0">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-2 py-1.5">
        <span className="label-xs">{title}</span>
        <ChevronDown className={cn("size-3 text-subtle transition-transform", !open && "-rotate-90")} />
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

export function LayerPanel({ onCollapse }: { onCollapse?: () => void } = {}) {
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  const advanced = useApp((s) => s.advanced);
  const setAdvanced = useApp((s) => s.setAdvanced);
  const liveEnabled = useApp((s) => s.layers.has("live-usgs") || s.layers.has("live-eonet"));
  const liveStatus = useApp((s) => s.liveDataStatus);
  const liveEvents = useApp((s) => s.liveEvents);
  const liveUpdatedAt = useApp((s) => s.liveDataUpdatedAt);
  const liveDataError = useApp((s) => s.liveDataError);
  const refreshLiveData = useApp((s) => s.refreshLiveData);
  const nisarStatus = useApp((s) => s.nisarStatus);
  const nisarError = useApp((s) => s.nisarError);
  const nisarGranules = useApp((s) => s.nisarGranules);
  const nisarGranuleHits = useApp((s) => s.nisarGranuleHits);
  const nisarCollections = useApp((s) => s.nisarCollections);
  const refreshNISARData = useApp((s) => s.refreshNISARData);

  const changeProduct = (product: string, enabled: boolean) => {
    const selected = useApp.getState().nisarSelectedProductCodes;
    const next = enabled
      ? [...new Set([...selected, product])]
      : selected.filter((code) => code !== product);
    if (!next.length) return;
    void refreshNISARData(next);
  };

  useEffect(() => {
    if (liveEnabled && liveStatus === "idle") void refreshLiveData();
  }, [liveEnabled, liveStatus, refreshLiveData]);
  return (
    <div className="glass flex max-h-full w-[244px] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <span className="font-mono text-[11px] tracking-[0.2em]">LAYERS</span>
        {onCollapse && <button type="button" onClick={onCollapse} className="rounded p-1 text-subtle hover:bg-elevated hover:text-foreground" aria-label="Collapse layers panel" title="Collapse layers panel">
          <PanelLeftClose className="size-4" />
        </button>}
      </div>
      <div className="m-3 grid grid-cols-2 rounded-md border border-border p-0.5 font-mono text-[10px] tracking-[0.15em]">
        {(["science", "intelligence"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={cn("rounded-[4px] py-1.5 uppercase transition-colors", mode === m ? "bg-elevated text-primary" : "text-subtle hover:text-foreground")}>{m}</button>
        ))}
      </div>
      <div className="scroll-thin flex-1 space-y-1 overflow-y-auto px-1.5 pb-2">
        <Section title="Satellite">
          <Row id="nisar-coverage" label="Real NISAR product coverage" swatch="#2EC4FF" tag="LIVE" />
          <Row id="nisar-footprints" label="Sample Observation Footprints" tag="SAMPLE" />
          <Row id="nisar-tracks" label="Sample Acquisition Tracks" tag="SAMPLE" />
        </Section>
        {mode === "science" ? (
          <Section title="NISAR Product Families">
            {NISAR_PRODUCTS.map((p) => <Row
              key={p}
              id={`prod-${p}`}
              label={p}
              swatch="#2EC4FF"
              tag="CATALOG"
              disabled={nisarStatus === "loading"}
              onToggle={(enabled) => {
                useApp.getState().toggleLayer(`prod-${p}`, enabled);
                changeProduct(p, enabled);
              }}
            />)}
            <div className="mx-2 mt-2 rounded-md border border-border bg-background/40 p-2.5">
              <div className="flex items-center justify-between gap-2"><span className="label-xs">NASA CMR STATUS</span><span className={cn("font-mono text-[9px]", nisarStatus === "ready" ? "text-ok" : nisarStatus === "partial" || nisarStatus === "error" ? "text-amber" : "text-subtle")}>{nisarStatus.toUpperCase()}</span></div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">{nisarGranules.length} granules loaded · {nisarGranuleHits.toLocaleString()} matches · {nisarCollections.length} collections in catalog.</p>
              {nisarError && <p role="status" className="mt-1 text-[10px] leading-relaxed text-amber">{nisarError}</p>}
              <Button size="sm" variant="outline" className="mt-2 h-7 w-full text-[10px]" disabled={nisarStatus === "loading"} onClick={() => void refreshNISARData()}>{nisarStatus === "loading" ? "SEARCHING NASA CMR…" : "REFRESH NISAR PRODUCTS"}</Button>
              <Link to="/data" className="mt-2 block text-center text-[10px] text-primary hover:underline">OPEN FULL DATA EXPLORER ↗</Link>
            </div>
          </Section>
        ) : (
          <Section title="Sample phenomena (demo only)">
            {PHENOMENA.map((p) => <Row key={p.id} id={p.id} label={p.label} swatch={p.color} tag="SAMPLE" />)}
          </Section>
        )}
        <Section title="Live data sources">
          <Row id="live-usgs" label="USGS earthquakes · M5+ / 2 y" swatch="#a98bff" tag="LIVE" />
          <Row id="live-eonet" label="NASA EONET · 2 y archive" swatch="#4fbf6a" tag="LIVE" />
          <div className="mx-2 mt-2 rounded-md border border-border bg-background/40 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="label-xs">FEED STATUS</span>
              <span className={cn("font-mono text-[9px]", liveStatus === "ready" ? "text-ok" : liveStatus === "partial" || liveStatus === "error" ? "text-amber" : "text-subtle")}>
                {liveStatus === "idle" ? "NOT LOADED" : liveStatus === "loading" ? "FETCHING" : liveStatus === "ready" ? "FEEDS LOADED" : liveStatus === "partial" ? "PARTIAL" : "UNAVAILABLE"}
              </span>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              {liveStatus === "ready" ? `${liveEvents.length} records · updated ${liveUpdatedAt?.replace("T", " ").slice(0, 16) ?? "just now"} UTC` :
                liveStatus === "loading" ? "Fetching public records from USGS and NASA EONET." :
                liveStatus === "error" ? (liveDataError ?? "No live records are available. Check your connection.") :
                liveStatus === "partial" ? (liveDataError ?? `${liveEvents.length} records retained; one source may be unavailable.`) :
                "Toggle a live layer to fetch public records. These are not NISAR measurements."}
            </p>
            <Button size="sm" variant="outline" className="mt-2 h-7 w-full text-[10px]" disabled={liveStatus === "loading"} onClick={() => void refreshLiveData()}>
              {liveStatus === "loading" ? "FETCHING SOURCES…" : "REFRESH LIVE FEEDS"}
            </Button>
          </div>
        </Section>
        <Section title="Terrain" defaultOpen={false}>
          <Row id="elevation" label="Elevation" swatch="#8a9aa6" demo />
          <Row id="slope" label="Slope" swatch="#8a9aa6" demo />
          <Row id="landcover" label="Land Cover" swatch="#8a9aa6" demo />
        </Section>
        {advanced && (
          <Section title="Advanced">
            {[["Polarization", "HH / HV"], ["Orbit", "Ascending"], ["Coherence min", "0.35"], ["Resolution", "20 m"], ["Quality mask", "On"]].map(([k, v]) => (
              <div key={k} className="flex justify-between px-2 py-1 text-[12px]"><span className="text-muted-foreground">{k}</span><span className="font-mono text-foreground">{v}</span></div>
            ))}
          </Section>
        )}
      </div>
      <button onClick={() => setAdvanced(!advanced)} className="flex items-center justify-between border-t border-border px-3 py-2.5 text-[12px] text-muted-foreground hover:text-foreground">
        Advanced controls
        <span className={cn("h-3.5 w-6 rounded-full border border-border p-px transition-colors", advanced && "border-primary")}>
          <span className={cn("block size-2.5 rounded-full bg-subtle transition-transform", advanced && "translate-x-2.5 bg-primary")} />
        </span>
      </button>
    </div>
  );
}
