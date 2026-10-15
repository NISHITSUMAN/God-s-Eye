import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { DATASETS, sampleDataProvider } from "@/lib/earth-data";
import { rectangleAOI } from "@/lib/analysis";

type SearchRegion = {
  id: string;
  name: string;
  keywords: string[];
  lat: number;
  lng: number;
  altitude: number;
  bounds: [number, number, number, number];
};

const REGIONS: SearchRegion[] = [
  {
    id: "india",
    name: "India",
    keywords: ["republic of india"],
    lat: 22.5,
    lng: 79.5,
    altitude: 1,
    bounds: [68, 6, 98, 38],
  },
  {
    id: "jammu-kashmir",
    name: "Jammu & Kashmir · India",
    keywords: ["jammu", "jammu and kashmir", "kashmir valley"],
    lat: 34,
    lng: 74.8,
    altitude: 0.07,
    bounds: [72.2, 32.1, 77.7, 37.3],
  },
  {
    id: "ladakh",
    name: "Ladakh · India",
    keywords: ["ladakh", "leh", "aksai chin"],
    lat: 34.4,
    lng: 78.1,
    altitude: 0.09,
    bounds: [74.9, 31.9, 81, 36.5],
  },
  {
    id: "kashmir-region",
    name: "Kashmir region · India-aligned boundary view",
    keywords: ["kashmir region", "greater kashmir"],
    lat: 34.4,
    lng: 76.2,
    altitude: 0.18,
    bounds: [72, 31.8, 81.2, 37.8],
  },
];

export function SearchBox() {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const debounce = window.setTimeout(() => setTerm(query.trim().toLowerCase()), 180);
    return () => window.clearTimeout(debounce);
  }, [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const state = useApp();
  const coordinateMatch = term.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  const latitude = coordinateMatch ? Number(coordinateMatch[1]) : NaN;
  const longitude = coordinateMatch ? Number(coordinateMatch[2]) : NaN;
  const validCoordinate = Boolean(
    coordinateMatch && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180,
  );

  const regions = REGIONS.filter(region =>
    `${region.name} ${region.keywords.join(" ")}`.toLowerCase().includes(term),
  );
  const places = sampleDataProvider.locations().filter(place =>
    place.name.toLowerCase().includes(term),
  );
  const sampleEvents = sampleDataProvider.events().filter(event =>
    `${event.title} ${event.region} ${event.type}`.toLowerCase().includes(term),
  );
  const sampleObservations = sampleDataProvider.observations().filter(observation =>
    `${observation.id} ${observation.region}`.toLowerCase().includes(term),
  );
  const datasets = DATASETS.filter(dataset =>
    `${dataset.id} ${dataset.name} ${dataset.description}`.toLowerCase().includes(term),
  );
  const analyses = state.analyses.filter(analysis =>
    `${analysis.kind} ${analysis.aoi.name}`.toLowerCase().includes(term),
  );
  const liveEvents = state.liveEvents.filter(event =>
    `${event.title} ${event.region} ${event.sourceLabel} ${event.source}`.toLowerCase().includes(term),
  );
  const nisarGranules = state.nisarGranules.filter(granule =>
    `${granule.granuleId} ${granule.productCode} ${granule.collectionShortName} ${granule.title}`.toLowerCase().includes(term),
  ).slice(0, 5);

  const done = () => {
    setOpen(false);
    setQuery("");
    setTerm("");
  };

  const focusRegion = (region: SearchRegion) => {
    const app = useApp.getState();
    const defaultProducts = ["GCOV", "GSLC", "GUNW", "SME2"];
    app.setNISARProductSelection(defaultProducts);
    app.setAOI(rectangleAOI(
      [region.bounds[0], region.bounds[1]],
      [region.bounds[2], region.bounds[3]],
    ));
    app.flyTo({ lat: region.lat, lng: region.lng, altitude: region.altitude });
    app.toggleLayer("nisar-coverage", true);
    for (const product of ["GCOV", "GSLC", "GUNW", "SME2"]) {
      app.toggleLayer(`prod-${product}`, true);
    }
    done();
  };

  const selectGranule = (id: string) => {
    useApp.getState().select(id);
    done();
  };

  const hasAnyResult = validCoordinate || regions.length > 0 || places.length > 0 ||
    sampleEvents.length > 0 || sampleObservations.length > 0 || datasets.length > 0 ||
    analyses.length > 0 || liveEvents.length > 0 || nisarGranules.length > 0;

  return (
    <div className="relative w-full max-w-[420px]">
      <div className="glass flex h-9 items-center gap-2 px-3">
        <Search className="size-3.5 shrink-0 text-subtle" />
        <input
          ref={input}
          aria-label="Global Earth search"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={event => { setQuery(event.target.value); setOpen(true); }}
          placeholder="Search places, NISAR products or coordinates"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
        />
        <kbd className="hidden text-[10px] text-subtle sm:block">Ctrl / ⌘ K</kbd>
      </div>
      {open && term && (
        <div className="glass absolute inset-x-0 top-11 z-50 max-h-[min(70vh,480px)] overflow-y-auto p-2">
          {validCoordinate && (
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                useApp.getState().flyTo({ lat: latitude, lng: longitude, altitude: 0.015 });
                done();
              }}
            >
              COORDINATES · {latitude}, {longitude}
            </Button>
          )}

          {regions.length > 0 && (
            <>
              <div className="label-xs px-2 py-2">INDIA / ADMINISTRATIVE AREAS</div>
              {regions.slice(0, 5).map(region => (
                <Button key={region.id} variant="ghost" className="h-auto w-full justify-start whitespace-normal py-2 text-left text-xs" onClick={() => focusRegion(region)}>
                  <span>{region.name}</span>
                </Button>
              ))}
            </>
          )}

          {nisarGranules.length > 0 && (
            <>
              <div className="label-xs px-2 py-2 text-primary">REAL NISAR PRODUCTS · NASA CMR</div>
              {nisarGranules.map(granule => (
                <Button key={granule.id} variant="ghost" className="h-auto w-full justify-start whitespace-normal py-2 text-left text-xs" onClick={() => selectGranule(granule.id)}>
                  <span className="min-w-0">
                    <span className="block font-mono text-primary">{granule.productCode} · {(granule.startDate || "").slice(0, 10) || "DATE N/A"}</span>
                    <span className="block break-all text-[10px]">{granule.granuleId}</span>
                  </span>
                </Button>
              ))}
            </>
          )}

          {places.length > 0 && (
            <>
              <div className="label-xs px-2 py-2">SAMPLE PLACES</div>
              {places.slice(0, 4).map(place => (
                <Button key={place.name} variant="ghost" className="w-full justify-start text-xs" onClick={() => {
                  useApp.getState().flyTo({ ...place, altitude: place.kind === "Country" ? 1 : 0.02 });
                  done();
                }}>
                  {place.name} · {place.kind}
                </Button>
              ))}
            </>
          )}

          {liveEvents.length > 0 && (
            <>
              <div className="label-xs px-2 py-2 text-ok">LIVE PUBLIC EVENTS</div>
              {liveEvents.slice(0, 4).map(event => (
                <Button key={event.id} variant="ghost" className="h-auto w-full justify-start whitespace-normal py-2 text-left text-xs" onClick={() => selectGranule(event.id)}>
                  {event.title} · {event.source}
                </Button>
              ))}
            </>
          )}

          {sampleEvents.length > 0 && (
            <>
              <div className="label-xs px-2 py-2 text-muted-foreground">ILLUSTRATIVE SAMPLE CANDIDATES</div>
              {sampleEvents.slice(0, 3).map(event => (
                <Button key={event.id} variant="ghost" className="h-auto w-full justify-start whitespace-normal py-2 text-left text-xs" onClick={() => selectGranule(event.id)}>
                  {event.title} · {event.region} · SAMPLE
                </Button>
              ))}
            </>
          )}

          {sampleObservations.length > 0 && (
            <>
              <div className="label-xs px-2 py-2">SAMPLE OBSERVATIONS</div>
              {sampleObservations.slice(0, 3).map(observation => (
                <Button key={observation.id} asChild variant="ghost" className="w-full justify-start text-xs">
                  <Link to="/observations/$id" params={{ id: observation.id }} onClick={done}>{observation.id} · SAMPLE</Link>
                </Button>
              ))}
            </>
          )}

          {datasets.length > 0 && (
            <>
              <div className="label-xs px-2 py-2">DATASETS</div>
              {datasets.slice(0, 5).map(dataset => (
                <Button key={dataset.id} asChild variant="ghost" className="w-full justify-start text-xs">
                  <Link to="/data" onClick={done}>{dataset.name} · {dataset.availability}</Link>
                </Button>
              ))}
            </>
          )}

          {analyses.length > 0 && (
            <>
              <div className="label-xs px-2 py-2">ANALYSES</div>
              {analyses.map(analysis => (
                <Button key={analysis.id} asChild variant="ghost" className="w-full justify-start text-xs">
                  <Link to="/analysis/$id" params={{ id: analysis.id }} onClick={done}>{analysis.kind}</Link>
                </Button>
              ))}
            </>
          )}

          {!hasAnyResult && (
            <p className="p-3 text-xs text-muted-foreground">
              No matches in the current catalogue. Try Jammu & Kashmir, Ladakh, NISAR, GCOV, or enter latitude and longitude.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
