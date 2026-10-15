import { useEffect } from "react";
import { Pause, Play, Columns2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { sampleDataProvider } from "@/lib/earth-data";

export function Timeline() {
  const time = useApp(s => s.time); const playing = useApp(s => s.playing); const speed = useApp(s => s.playbackSpeed); const comparison = useApp(s => s.investigation.comparison);
  const liveEvents = useApp(s => s.liveEvents);
  const layers = useApp(s => s.layers);
  const setDate = useApp(s => s.setCurrentDate); const setRange = useApp(s => s.setTimeRange); const setPlaying = useApp(s => s.setPlaying);
  const start = Date.parse(time.start); const end = Date.parse(time.end); const current = Date.parse(time.current);
  const entries = [
    ...sampleDataProvider.events()
      .filter((event) => event.date >= time.start && event.date <= time.end)
      .map((event) => ({ id: event.id, title: event.title, date: event.date, label: event.type, source: "SAMPLE" as const })),
    ...liveEvents
      .filter((event) => layers.has(event.layerId) && event.date.slice(0, 10) >= time.start && event.date.slice(0, 10) <= time.end)
      .map((event) => ({ id: event.id, title: event.title, date: event.date.slice(0, 10), label: event.type, source: event.source })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  useEffect(() => { if (!playing) return; const timer = setInterval(() => { const state = useApp.getState(); const next = Date.parse(state.time.current) + 86400000 * 7; state.setCurrentDate(new Date(next > Date.parse(state.time.end) ? Date.parse(state.time.start) : next).toISOString().slice(0,10)); }, 800 / speed); return () => clearInterval(timer); }, [playing, speed]);
  return <div className="earth-timeline glass w-full px-3 py-2">
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" size="icon" aria-label={playing ? "Pause timeline" : "Play timeline"} onClick={() => setPlaying(!playing)}>{playing ? <Pause /> : <Play />}</Button>
      <Button variant="ghost" size="sm" aria-label="Playback speed" onClick={() => useApp.getState().setPlaybackSpeed(speed === 4 ? 1 : speed === 1 ? 2 : 4)}>{speed}×</Button>
      <label className="hidden items-center gap-1 text-[10px] text-subtle md:flex">FROM<input aria-label="Timeline start" type="date" value={time.start} max={time.end} onChange={e => setRange({ start:e.target.value,end:time.end })} className="instrument-input" /></label>
      <label className="hidden items-center gap-1 text-[10px] text-subtle md:flex">TO<input aria-label="Timeline end" type="date" value={time.end} min={time.start} onChange={e => setRange({ start:time.start,end:e.target.value })} className="instrument-input" /></label>
      <div className="min-w-[90px] flex-1"><input aria-label="Selected timeline date" type="range" min={start} max={end} step={86400000} value={Math.min(end,Math.max(start,current))} onChange={e => setDate(new Date(Number(e.target.value)).toISOString().slice(0,10))} className="w-full accent-primary" /></div>
      <span className="font-mono text-[10px] text-primary">{time.current}</span>
      <Button variant={comparison ? "secondary" : "ghost"} size="icon" title="Before / after comparison" aria-label="Before after comparison" aria-pressed={Boolean(comparison)} onClick={() => useApp.getState().setInvestigation({ comparison: comparison ? null : "before-after" })}><Columns2 /></Button>
    </div>
    <div className="timeline-entries flex gap-1 overflow-x-auto border-t border-border pt-1">{entries.map((entry) => <Button key={entry.id} variant="ghost" className={`h-6 shrink-0 px-2 font-mono text-[9px] ${entry.source === "SAMPLE" ? "text-muted-foreground" : "text-ok"}`} title={`${entry.title} · ${entry.date} · ${entry.source}`} onClick={() => useApp.getState().select(entry.id)}>{entry.date.slice(5)} · {entry.label} · {entry.source}</Button>)}
      {entries.length === 0 && <span className="px-2 py-2 text-[10px] text-subtle">No events in this time range. Load a live feed or widen the range.</span>}</div>
  </div>;
}
