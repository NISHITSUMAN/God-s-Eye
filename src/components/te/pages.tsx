import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, RefreshCw } from "lucide-react";
import { useApp } from "@/lib/store";
import { EVENTS, OBSERVATIONS, PHENOMENA, formatCoord, phenomenonColor, phenomenonLabel, type Phenomenon } from "@/lib/mock-data";
import { ObservationCatalog, EventCatalog, DiscoverFindings } from "./CatalogViews";
import { AnalyzeFlow } from "./AnalyzeFlow";
import { ScienceLearn } from "./ScientificViews";
import { Panel } from "./PageShell";
import { NISARCatalog } from "./NISARCatalog";
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
  const status = useApp((s) => s.liveDataStatus);
  const liveEvents = useApp((s) => s.liveEvents);
  const updatedAt = useApp((s) => s.liveDataUpdatedAt);
  const error = useApp((s) => s.liveDataError);
  const refresh = useApp((s) => s.refreshLiveData);
  return (
    <div className="space-y-5">
      <section className="scientific-band">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="label-xs text-ok">PUBLIC DATA CONNECTIONS</div>
            <h2 className="mt-2 text-lg">Live event feeds</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Fetch source-reported earthquakes from USGS and open environmental events from NASA EONET.
              These provide live geographic context only. They are not radar measurements, hazard predictions, or NISAR products.
            </p>
          </div>
          <button onClick={() => void refresh()} disabled={status === "loading"} className="inline-flex h-9 items-center gap-2 rounded-md border border-primary/40 px-3 text-xs text-primary transition-colors hover:bg-primary/10 disabled:cursor-wait disabled:opacity-60">
            <RefreshCw className={cn("size-3.5", status === "loading" && "animate-spin")} />
            {status === "loading" ? "FETCHING FEEDS" : "REFRESH PUBLIC FEEDS"}
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">USGS Earthquake Feed</span><span className="font-mono text-[9px] text-ok">PUBLIC · 24 HOUR</span></div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Earthquake locations, reported magnitudes, depths, timestamps, and source records.</p>
            <a className="mt-2 inline-block text-[11px] text-primary hover:underline" href="https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php" target="_blank" rel="noopener noreferrer">Feed documentation ↗</a>
          </div>
          <div className="rounded-md border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">NASA EONET</span><span className="font-mono text-[9px] text-ok">PUBLIC · OPEN EVENTS</span></div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Open wildfire, flood, landslide, and volcano events where EONET provides a usable geometry.</p>
            <a className="mt-2 inline-block text-[11px] text-primary hover:underline" href="https://eonet.gsfc.nasa.gov/docs/v3" target="_blank" rel="noopener noreferrer">API documentation ↗</a>
          </div>
        </div>
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="label-xs">STATUS · {status.replace("-", " ").toUpperCase()}</span>
            <span className="font-mono text-muted-foreground">{liveEvents.length} live records in memory</span>
          </div>
          {updatedAt && <p className="mt-1 text-[11px] text-muted-foreground">Last successful refresh: {updatedAt.replace("T", " ").slice(0, 19)} UTC</p>}
          {error && <p role="status" className="mt-2 text-xs text-amber">{error}</p>}
        </div>
      </section>
      <NISARCatalog />
      <div className="label-xs mt-8">COMMON NISAR PRODUCT FAMILIES · REFERENCE ONLY</div>
      <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">These are familiar product families, not a substitute for the live CMR results above. Availability, collection versions, access conditions, and coverage depend on the exact catalog record.</p>
      <div className="grid gap-3 md:grid-cols-3">
        {PRODUCTS.map(([id, name, lvl]) => (
          <Panel key={id} className="p-5">
            <div className="flex justify-between"><span className="font-mono text-[14px] text-primary">NISAR-{id}</span><span className="font-mono text-[10px] text-subtle">{lvl}</span></div>
            <div className="mt-2 text-[13px] text-muted-foreground">{name}</div>
            <div className="mt-4 font-mono text-[10px] tracking-wider text-subtle">PRODUCT FAMILY · CHECK LIVE CMR RECORD ABOVE</div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

export const LearnBody = ScienceLearn;

type DisplaySettings = {
  units: "Metric" | "Imperial";
  coords: "Decimal degrees" | "DMS";
};

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  units: "Metric",
  coords: "Decimal degrees",
};

function formatDMS(value: number, positive: string, negative: string) {
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minuteValue = (absolute - degrees) * 60;
  const minutes = Math.floor(minuteValue);
  const seconds = ((minuteValue - minutes) * 60).toFixed(1);
  return `${degrees}° ${minutes}' ${seconds}" ${value >= 0 ? positive : negative}`;
}

export function SettingsBody() {
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("te-display-settings");
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<DisplaySettings>;
        setSettings({
          units: parsed.units === "Imperial" ? "Imperial" : "Metric",
          coords: parsed.coords === "DMS" ? "DMS" : "Decimal degrees",
        });
      }
    } catch {
      // Invalid or blocked local storage should never stop the settings screen.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("te-display-settings", JSON.stringify(settings));
    } catch {
      // The controls remain usable in private browsing when storage is unavailable.
    }
  }, [settings]);

  const setOption = (key: "units" | "coords", value: string) => {
    setSettings((current) => key === "units"
      ? { ...current, units: value as DisplaySettings["units"] }
      : { ...current, coords: value as DisplaySettings["coords"] });
  };
  const example = settings.coords === "DMS"
    ? `${formatDMS(19.076, "N", "S")}  ${formatDMS(72.8777, "E", "W")}`
    : formatCoord(19.076, 72.8777);

  const preferences = [
    { label: "Units", key: "units" as const, options: ["Metric", "Imperial"] as const },
    { label: "Coordinates", key: "coords" as const, options: ["Decimal degrees", "DMS"] as const },
  ];

  return (
    <Panel className="divide-y divide-border">
      {preferences.map(({ label, key, options }) => (
        <div key={key} className="flex flex-wrap items-center justify-between gap-3 p-4 text-[13px]">
          <span>{label}</span>
          <div className="flex gap-1">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={settings[key] === option}
                onClick={() => setOption(key, option)}
                className={cn(
                  "rounded-md border px-3 py-1 text-[12px] transition-colors",
                  settings[key] === option ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-elevated",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 p-4 text-[13px]">
        <div>
          <div>Replay intro animation</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Show the Third Eye title screen again.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem("te-intro");
            window.location.reload();
          }}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-[12px] transition-colors hover:bg-elevated"
        >
          Replay
        </button>
      </div>
      <div className="space-y-1 p-4">
        <div className="label-xs">COORDINATE PREVIEW</div>
        <div className="font-mono text-[11px] text-muted-foreground">{example}</div>
        <p className="text-[10px] text-subtle">Units: {settings.units}. Preferences are saved on this device.</p>
      </div>
    </Panel>
  );
}

export function AboutBody() {
  return (
    <Panel className="max-w-2xl p-6 text-[14px] leading-relaxed text-muted-foreground">
      <p>Third Eye is an Earth-observation exploration prototype with a 3D globe, 2D map, timeline, area-of-interest workflow, scientific catalog views, and an interface command simulator.</p>
      <p className="mt-3">Optional live context feeds can display source-reported earthquakes from USGS and open natural events from NASA EONET. They are separate from the illustrative NISAR-style science overlays.</p>
      <div className="mt-4 rounded-md border border-border bg-background/40 p-4">
        <div className="label-xs text-amber">SCIENTIFIC LIMITATIONS</div>
        <p className="mt-2 text-[13px]">This build does not ingest, process, or interpret real NISAR radar measurements. Sample events, observation metadata, geometries, and analysis outputs are demonstrative. The command interface simulates actions; it is not a connected AI assistant or hazard-prediction system.</p>
      </div>
      <Link to="/" className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground">Open Explore</Link>
    </Panel>
  );
}
