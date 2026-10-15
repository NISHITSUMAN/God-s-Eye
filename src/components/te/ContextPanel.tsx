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
