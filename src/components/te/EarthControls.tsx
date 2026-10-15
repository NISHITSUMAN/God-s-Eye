import { useEffect } from "react";
import { Globe2, Map, X, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp, type EarthFilter } from "@/lib/store";

export function EarthControls() {
  const mode = useApp(s => s.earthMode); const setMode = useApp(s => s.setEarthMode); const lod = useApp(s => s.lod);
  return <div className="earth-mode glass flex items-center gap-1 p-1">
    <Button size="sm" variant={mode === "3d" ? "secondary" : "ghost"} aria-pressed={mode === "3d"} onClick={() => setMode("3d")}><Globe2 />3D EARTH</Button>
    <Button size="sm" variant={mode === "2d" ? "secondary" : "ghost"} aria-pressed={mode === "2d"} onClick={() => setMode("2d")}><Map />2D MAP</Button>
    <span className="hidden px-2 font-mono text-[9px] text-subtle sm:inline">{lod.toUpperCase()}</span>
  </div>;
}

export function SignificanceControls() {
  const filter = useApp(s => s.filter); const set = useApp(s => s.setFilter);
  return <details className="significance-control glass">
    <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 font-mono text-[10px]"><SlidersHorizontal className="size-3" />SIGNIFICANCE: {filter.significance.toUpperCase()}</summary>
    <div className="grid gap-3 border-t border-border p-3">
      {([
        ["significance", "Significance", ["all", "high", "moderate+"]],
        ["confidence", "Confidence", ["all", "high", "moderate+", "low+"]],
        ["severity", "Severity", ["all", "high", "moderate", "low"]],
        ["evidence", "Evidence", ["all", "nisar", "supporting", "multi-source"]],
      ] as const).map(([key, label, values]) => <label key={key} className="flex items-center justify-between gap-4 text-xs"><span>{label}</span><select aria-label={label} value={filter[key]} onChange={event => set({ [key]: event.target.value } as Partial<EarthFilter>)} className="instrument-select">{values.map(value => <option key={value} value={value}>{value === "nisar" ? "NISAR ONLY" : value === "supporting" ? "SUPPORTING ONLY" : value === "multi-source" ? "MULTI-SOURCE" : value.toUpperCase()}</option>)}</select></label>)}
    </div>
  </details>;
}

const GUIDE = ["Explore the Earth", "Turn layers on or off", "Select an observation", "Ask Third Eye to investigate"];
export function FirstUseGuide() {
  const step = useApp(s => s.guideStep); const setStep = useApp(s => s.setGuideStep);
  useEffect(() => { if (localStorage.getItem("te-guide-dismissed")) setStep(null); }, [setStep]);
  if (step === null) return null;
  const close = (remember = false) => { if (remember) localStorage.setItem("te-guide-dismissed", "1"); setStep(null); };
  return <aside className="first-use glass p-3" aria-label="First-use guidance">
    <div className="flex items-center justify-between gap-4"><span className="label-xs">{step + 1} / 4</span><Button variant="ghost" size="icon" className="size-6" aria-label="Skip guidance" onClick={() => close()}><X /></Button></div>
    <p className="mt-1 text-xs">{GUIDE[step]}</p>
    <div className="mt-2 flex items-center justify-between gap-2"><label className="flex items-center gap-1 text-[10px] text-muted-foreground"><input type="checkbox" onChange={e => { if (e.target.checked) localStorage.setItem("te-guide-dismissed", "1"); else localStorage.removeItem("te-guide-dismissed"); }} />Don’t show again</label><Button variant="ghost" size="sm" onClick={() => step >= 3 ? close() : setStep(step + 1)}>{step >= 3 ? "Done" : "Next"}<ChevronRight /></Button></div>
  </aside>;
}
