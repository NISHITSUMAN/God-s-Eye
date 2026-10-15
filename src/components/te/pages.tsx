import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useApp } from "@/lib/store";
import { EVENTS, OBSERVATIONS, PHENOMENA, formatCoord, phenomenonColor, phenomenonLabel, type Phenomenon } from "@/lib/mock-data";
import { ObservationCatalog, EventCatalog, DiscoverFindings } from "./CatalogViews";
import { AnalyzeFlow } from "./AnalyzeFlow";
import { ScienceLearn } from "./ScientificViews";
import { Panel } from "./PageShell";
import { cn } from "@/lib/utils";

function useOpen() {
  const nav = useNavigate();
  return (id: string) => { useApp.getState().setOnboarded(true); useApp.getState().select(id); nav({ to: "/" }); };
}

const Dot = ({ type }: { type: Phenomenon }) => <span className="inline-block size-1.5 rounded-full" style={{ background: phenomenonColor(type) }} />;

export const DiscoverBody = DiscoverFindings;
export const EventsBody = EventCatalog;
export const ObservationsBody = ObservationCatalog;

export function TimelineBody() {
  const open = useOpen();
  const list = [...EVENTS].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="relative border-l border-border pl-6">
      {list.map((e) => (
        <button key={e.id} onClick={() => open(e.id)} className="group relative mb-6 block text-left">
          <span className="absolute -left-[28px] top-1.5 size-2 rounded-full ring-4 ring-background" style={{ background: phenomenonColor(e.type) }} />
          <div className="font-mono text-[11px] text-subtle">{e.date}</div>
          <div className="mt-0.5 text-[15px] group-hover:text-primary">{e.title} — {e.region}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{e.metric} · {e.observationId}</div>
        </button>
      ))}
    </div>
  );
}

export const AnalyzeBody = AnalyzeFlow;

const PRODUCTS = [
  ["RSLC", "Range-Doppler single-look complex", "L1"], ["RIFG", "Range-Doppler interferogram", "L1"], ["RUNW", "Unwrapped interferogram", "L1"], ["ROFF", "Range-Doppler pixel offsets", "L1"],
  ["GSLC", "Geocoded single-look complex", "L2"], ["GCOV", "Geocoded polarimetric covariance", "L2"], ["GUNW", "Geocoded unwrapped interferogram", "L2"], ["GOFF", "Geocoded pixel offsets", "L2"], ["SME2", "Soil moisture", "L3"],
];
export function DataBody() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {PRODUCTS.map(([id, name, lvl]) => (
        <Panel key={id} className="p-5">
          <div className="flex justify-between"><span className="font-mono text-[14px] text-primary">NISAR-{id}</span><span className="font-mono text-[10px] text-subtle">{lvl}</span></div>
          <div className="mt-2 text-[13px] text-muted-foreground">{name}</div>
          <div className="mt-4 font-mono text-[10px] tracking-wider text-subtle">BACKEND CONNECTION PENDING</div>
        </Panel>
      ))}
    </div>
  );
}

export const LearnBody = ScienceLearn;

export function SettingsBody() {
  const [s, set] = useState({ motion: true, units: "Metric", coords: "Decimal degrees", intro: true });
  return (
    <Panel className="divide-y divide-border">
      {[["Units", "units", ["Metric", "Imperial"]], ["Coordinates", "coords", ["Decimal degrees", "DMS"]]].map(([l, k, o]) => (
        <div key={k as string} className="flex items-center justify-between p-4 text-[13px]"><span>{l as string}</span>
          <div className="flex gap-1">{(o as string[]).map((x) => <button key={x} onClick={() => set({ ...s, [k as string]: x })} className={cn("rounded-md border px-3 py-1 text-[12px]", (s as any)[k as string] === x ? "border-primary text-primary" : "border-border text-muted-foreground")}>{x}</button>)}</div>
        </div>
      ))}
      <div className="flex items-center justify-between p-4 text-[13px]"><span>Replay intro animation</span><button onClick={() => sessionStorage.removeItem("te-intro")} className="rounded-md border border-border px-3 py-1 text-[12px]">Reset</button></div>
      <div className="p-4 font-mono text-[11px] text-subtle">Example coordinate: {formatCoord(19.076, 72.8777)}</div>
    </Panel>
  );
}

export function AboutBody() {
  return (
    <Panel className="max-w-2xl p-6 text-[14px] leading-relaxed text-muted-foreground">
      <p>Third Eye is an Earth-first intelligence platform that combines NISAR radar observations with complementary environmental datasets to explore, detect and interpret change across the planet.</p>
      <p className="mt-3">This build is a frontend prototype. Every event, observation and metric shown is illustrative and labelled as such until live data services are connected.</p>
      <Link to="/" className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground">Open Explore</Link>
    </Panel>
  );
}
