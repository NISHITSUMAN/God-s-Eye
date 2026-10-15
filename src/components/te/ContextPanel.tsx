import { sampleDataProvider, severityBand } from "@/lib/earth-data";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useApp } from "@/lib/store";
import { EVENTS, formatCoord, phenomenonColor, type Strength } from "@/lib/mock-data";
import { Link } from "@tanstack/react-router";
import { runCommand } from "@/lib/ai-agent";
import { LogoMark } from "./Logo";

const strengthColor: Record<Strength, string> = { Strong: "var(--ok)", Moderate: "var(--amber)", Weak: "var(--subtle)" };

export function ContextPanel() {
  const selectedId = useApp((s) => s.selectedId);
  const select = useApp((s) => s.select);
  const e = selectedId ? sampleDataProvider.event(selectedId) : undefined;
  const live = useApp((s) => selectedId ? s.liveEvents.find((item) => item.id === selectedId) : undefined);
  const nisar = useApp((s) => selectedId ? s.nisarGranules.find((item) => item.id === selectedId) : undefined);

  if (nisar) {
    const boundsText = nisar.bounds
      ? [nisar.bounds.west, nisar.bounds.south, nisar.bounds.east, nisar.bounds.north].map(value => value.toFixed(3)).join(", ")
      : "Footprint not reported in CMR metadata";
    return (
      <div className="glass scroll-thin w-[320px] animate-fade-up overflow-y-auto">
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-primary">
            <span className="size-1.5 rounded-full bg-primary" />REAL NISAR PRODUCT · NASA CMR
          </div>
          <h2 className="mt-2 break-words text-[15px] font-medium leading-snug">{nisar.productCode} acquisition</h2>
          <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{nisar.granuleId}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">{nisar.collectionShortName}</p>
        </div>
        <div className="space-y-3 p-4">
          {nisar.browseUrl ? (
            <a href={nisar.browseUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md border border-border bg-background/50">
              <img src={nisar.browseUrl} alt={`NASA/ASF browse preview for ${nisar.granuleId}`} loading="lazy" className="max-h-52 w-full object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} />
              <span className="block px-2 py-1.5 font-mono text-[9px] text-primary">OPEN ORIGINAL BROWSE IMAGE ↗</span>
            </a>
          ) : (
            <div className="rounded-md border border-border bg-background/30 p-3 text-xs text-muted-foreground">No direct browse image was supplied for this granule. Open the NASA Earthdata record to inspect available files.</div>
          )}
          <dl className="metadata-grid">
            <div><dt>Acquisition start</dt><dd>{nisar.startDate ? nisar.startDate.replace("T", " ").slice(0, 19) + " UTC" : "Not reported"}</dd></div>
            <div><dt>Acquisition end</dt><dd>{nisar.endDate ? nisar.endDate.replace("T", " ").slice(0, 19) + " UTC" : "Not reported"}</dd></div>
            <div><dt>Processing level</dt><dd>{nisar.collectionShortName.match(/L[0-3]|L0B/i)?.[0] ?? "See collection metadata"}</dd></div>
            <div><dt>Spatial extent</dt><dd>{nisar.footprint && nisar.footprint.length >= 3 ? "Source granule polygon" : "Approximate CMR bounding rectangle"}</dd></div>
            <div><dt>Extent bounds</dt><dd>{boundsText}</dd></div>
            <div><dt>Data provider</dt><dd>{nisar.producer || "NASA CMR / ASF"}</dd></div>
          </dl>
          <div className="grid gap-2">
            <a href={nisar.earthdataSearchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">OPEN EARTHDATA RECORD ↗</a>
            <a href={nisar.metadataUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-xs">NASA CMR METADATA ↗</a>
            {nisar.dataUrl && <a href={nisar.dataUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-xs">OPEN DATA FILE ↗</a>}
          </div>
          <p className="font-mono text-[9px] leading-relaxed tracking-wider text-subtle">REAL CATALOG RECORD · THE BROWSE IMAGE IS A QUICKLOOK, NOT THE FULL SCIENCE RASTER. ACCESS TO THE FULL PRODUCT MAY REQUIRE EARTHDATA LOGIN.</p>
        </div>
      </div>
    );
  }

  if (live) {
    return (
      <div className="glass scroll-thin w-[320px] animate-fade-up overflow-y-auto">
        <div className="flex items-start justify-between border-b border-border p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-ok">
              <span className="size-1.5 animate-pulse rounded-full bg-ok" />LIVE PUBLIC FEED · {live.source}
            </div>
            <h2 className="mt-2 text-[17px] font-medium leading-snug tracking-tight">{live.title}</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">{live.region}</p>
            <div className="mt-2 font-mono text-[11px] text-muted-foreground">{formatCoord(live.lat, live.lng)}</div>
          </div>
          <Button variant="ghost" onClick={() => select(null)} aria-label="Dismiss" className="shrink-0 text-subtle hover:text-foreground"><X className="size-4" /></Button>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <div className="font-mono text-[25px] font-light text-foreground">{live.metric}</div>
            <div className="label-xs mt-0.5">{live.metricLabel}</div>
          </div>
          <div className="rounded-md border border-border bg-background/40 p-3">
            <div className="label-xs mb-2">SOURCE REPORT</div>
            <p className="text-[13px] leading-relaxed text-foreground/90">{live.summary}</p>
            <div className="mt-3 text-[11px] text-muted-foreground">Reported time: {live.date.replace("T", " ").slice(0, 19)} UTC</div>
          </div>
          <a href={live.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-primary/40 px-3 py-2.5 text-[12px] text-primary transition-colors hover:bg-primary/10">
            OPEN SOURCE RECORD <span aria-hidden="true">↗</span>
          </a>
          <p className="font-mono text-[9px] leading-relaxed tracking-wider text-subtle">
            SOURCE-REPORTED EVENT · NOT A NISAR MEASUREMENT OR A THIRD EYE HAZARD PREDICTION
          </p>
        </div>
      </div>
    );
  }

  if (!e) {
    return (
      <div className="glass w-[300px] p-5">
        <div className="mb-3 flex items-center gap-2"><LogoMark size={16} /><span className="font-mono text-[11px] tracking-[0.25em]">THIRD EYE</span></div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">Select an observation, event, region, or change to inspect.</p>
      </div>
    );
  }
  return (
    <div className="glass scroll-thin w-[320px] animate-fade-up overflow-y-auto">
      <div className="flex items-start justify-between border-b border-border p-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em]" style={{ color: phenomenonColor(e.type) }}>
            <span className="size-1.5 rounded-full" style={{ background: phenomenonColor(e.type) }} />{e.title.toUpperCase()}
          </div>
          <h2 className="mt-1.5 text-[18px] font-medium tracking-tight">{e.region}</h2>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">{formatCoord(e.lat, e.lng)}</div>
        </div>
        <Button variant="ghost" onClick={() => select(null)} aria-label="Dismiss" className="text-subtle hover:text-foreground"><X className="size-4" /></Button>
      </div>
      <div className="space-y-5 p-4">
        <div>
          <div className="font-mono text-[26px] font-light text-foreground">{e.metric}</div>
          <div className="label-xs mt-0.5">{e.metricLabel}</div>
        </div>
        <div>
          <div className="label-xs mb-2">Evidence</div>
          <div className="space-y-1.5">
            {e.evidence.map((ev) => (
              <div key={ev.source} className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">{ev.source}</span>
                <span className="flex items-center gap-1.5 font-mono text-[11px]"><span className="size-1.5 rounded-full" style={{ background: strengthColor[ev.strength] }} />{ev.strength}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="label-xs mb-1.5">INTERPRETED · {e.stage.toUpperCase()} SIGNAL · {severityBand(e.severity).toUpperCase()} SEVERITY</div>
          <p className="text-[13px] leading-relaxed text-foreground/90">{e.interpretation}</p>
        </div>
        <div className="flex items-center justify-between">
          <div><div className="label-xs mb-1">Confidence</div><div className="font-mono text-[12px] tracking-wider text-amber">{e.confidence.toUpperCase()}</div></div>
          <div className="text-right"><div className="label-xs mb-1">Source</div><Link to="/observations/$id" params={{id:e.observationId}} className="font-mono text-[11px] text-primary hover:underline">{e.observationId}</Link></div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Link to="/analyze" className="rounded-md bg-primary px-3 py-2 text-center text-[12px] font-medium text-primary-foreground hover:opacity-90">Investigate</Link>
          <Button variant="ghost" onClick={() => runCommand("Compare before and after")} className="rounded-md border border-border px-3 py-2 text-[12px] hover:bg-elevated">Before / After</Button>
          <Button variant="ghost" onClick={() => runCommand("Explain what I'm looking at")} className="rounded-md border border-border px-3 py-2 text-[12px] hover:bg-elevated">Show Evidence</Button>
          <Button variant="ghost" onClick={() => { useApp.getState().setAIActive(true); runCommand("Explain what I'm looking at"); }} className="rounded-md border border-border px-3 py-2 text-[12px] text-primary hover:bg-elevated">Ask Third Eye</Button>
        </div>
        <p className="font-mono text-[9px] tracking-wider text-subtle">ILLUSTRATIVE DEMO DATA — NOT A LIVE MEASUREMENT</p>
      </div>
    </div>
  );
}
