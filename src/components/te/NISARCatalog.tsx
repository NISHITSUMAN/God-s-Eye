import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Database, Search, RefreshCw, Satellite, Clock3, MapPin, FileSearch, ChevronDown, ChevronUp } from "lucide-react";
import { useApp } from "@/lib/store";
import {
  searchNISARGranules,
  type NISARCollection,
  type NISARGranule,
} from "@/lib/nasa-cmr";
import { cn } from "@/lib/utils";

type LoadState = "idle" | "loading" | "ready" | "partial" | "error";

function formatDate(value: string | null) {
  if (!value) return "Not reported";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().replace("T", " ").slice(0, 16) + " UTC" : value;
}

function SourceLink({ href, children }: { href: string; children: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
    {children}<ExternalLink className="size-3" aria-hidden="true" />
  </a>;
}

export function NISARCatalog() {
  const aoi = useApp((state) => state.aoi);
  const time = useApp((state) => state.time);
  const collections = useApp((state) => state.nisarCollections);
  const hits = useApp((state) => state.nisarCollectionHits);
  const state = useApp((state) => state.nisarStatus) as LoadState;
  const error = useApp((state) => state.nisarError);
  const liveGranules = useApp((state) => state.nisarGranules);
  const liveGranuleHits = useApp((state) => state.nisarGranuleHits);
  const liveUpdatedAt = useApp((state) => state.nisarUpdatedAt);
  const refreshCoverage = useApp((state) => state.refreshNISARData);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [granules, setGranules] = useState<NISARGranule[]>([]);
  const [granuleHits, setGranuleHits] = useState(0);
  const [granuleState, setGranuleState] = useState<LoadState>("idle");
  const [granuleError, setGranuleError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const selected = collections.find((collection) => collection.conceptId === selectedId) ?? null;
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return collections;
    return collections.filter((collection) =>
      `${collection.title} ${collection.shortName} ${collection.processingLevel} ${collection.abstract}`.toLowerCase().includes(term),
    );
  }, [collections, query]);
  const visible = showAll ? filtered : filtered.slice(0, 8);

  const loadCollections = () => {
    setGranules([]);
    setGranuleHits(0);
    setGranuleState("idle");
    setGranuleError(null);
    void refreshCoverage();
  };

  useEffect(() => {
    if (collections.length && !collections.some((item) => item.conceptId === selectedId)) {
      setSelectedId(collections[0]?.conceptId ?? "");
    }
  }, [collections, selectedId]);

  const loadGranules = async () => {
    if (!selected) return;
    setGranuleState("loading");
    setGranuleError(null);
    try {
      const bounds = aoi?.bounds;
      const validAOI = bounds && bounds.length === 4 && bounds.every(Number.isFinite)
        ? { west: bounds[0]!, south: bounds[1]!, east: bounds[2]!, north: bounds[3]! }
        : null;
      const result = await searchNISARGranules({
        collectionConceptId: selected.conceptId,
        collectionShortName: selected.shortName,
        bounds: validAOI,
        startDate: time.start,
        endDate: time.end,
        pageSize: 20,
      });
      setGranules(result.granules);
      setGranuleHits(result.hits);
      setGranuleState("ready");
    } catch (reason) {
      setGranuleState("error");
      setGranuleError(reason instanceof Error ? reason.message : "Granule metadata could not be loaded.");
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-panel">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-background/35 p-4 sm:p-5">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <Satellite className="size-5" aria-hidden="true" />
          </div>
          <div>
            <div className="label-xs text-primary">NASA EARTHDATA · COMMON METADATA REPOSITORY</div>
            <h2 className="mt-1 text-lg font-medium">NISAR product catalog</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Search official NISAR collection and granule metadata. This queries NASA’s catalog; it does not download or process radar imagery.
            </p>
          </div>
        </div>
        <button type="button" onClick={() => void loadCollections()} disabled={state === "loading"} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-primary/40 px-3 text-xs text-primary transition-colors hover:bg-primary/10 disabled:cursor-wait disabled:opacity-60">
          <RefreshCw className={cn("size-3.5", state === "loading" && "animate-spin")} />
          {state === "loading" ? "QUERYING NASA CMR" : (state === "ready" || state === "partial") ? "REFRESH CATALOG" : "LOAD LIVE CATALOG"}
        </button>
      </header>

      <div className="border-b border-border p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="label-xs text-primary">LIVE NISAR ACQUISITIONS</div>
            <h3 className="mt-1 text-base font-medium">Real NISAR product records for your area</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">These footprints and metadata come from NASA CMR granule records. Browse images are optional previews, not the full scientific raster; records without images are still searchable.</p>
          </div>
          <div className="text-right font-mono text-[10px] text-muted-foreground">
            <div>{liveGranules.length} shown · {liveGranuleHits.toLocaleString()} matching records</div>
            {liveUpdatedAt && <div className="mt-1">UPDATED {liveUpdatedAt.slice(0, 16).replace("T", " ")} UTC</div>}
          </div>
        </div>
        {liveGranules.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {liveGranules.slice(0, 4).map((granule) => (
              <article key={granule.conceptId} className="flex min-w-0 gap-3 rounded-lg border border-border bg-background/35 p-3">
                {granule.browseUrl ? (
                  <a href={granule.browseUrl} target="_blank" rel="noopener noreferrer" className="block h-24 w-28 shrink-0 overflow-hidden rounded border border-border bg-background">
                    <img src={granule.browseUrl} alt={`NISAR ${granule.productCode} browse image`} loading="lazy" className="h-full w-full object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                  </a>
                ) : (
                  <div className="flex h-24 w-28 shrink-0 items-center justify-center rounded border border-border bg-background font-mono text-[9px] text-subtle">NO PREVIEW</div>
                )}
                <div className="min-w-0">
                  <div className="font-mono text-[10px] text-primary">{granule.productCode} · {granule.startDate?.slice(0, 10) ?? "DATE N/A"}</div>
                  <div className="mt-1 break-all text-[11px] leading-snug">{granule.granuleId}</div>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <SourceLink href={granule.earthdataSearchUrl}>Earthdata record</SourceLink>
                    <SourceLink href={granule.metadataUrl}>CMR metadata</SourceLink>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
            {state === "loading" ? "Searching NASA CMR for current granule coverage…" : state === "error" ? (error || "The live catalog is unavailable.") : "No NISAR granules matched the current India area and date range. Browse images are optional; refresh, widen the date range, or try another area."}
          </div>
        )}
        {state === "partial" && error && <p className="mt-2 text-[11px] text-amber">{error}</p>}
      </div>

      <div className="border-b border-border p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-background/30 p-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Database className="size-3.5" />COLLECTIONS</div>
            <div className="mt-2 font-mono text-2xl">{(state === "ready" || state === "partial") ? hits.toLocaleString() : "—"}</div>
            <div className="mt-1 text-[10px] text-subtle">CMR-reported matching records</div>
          </div>
          <div className="rounded-lg border border-border bg-background/30 p-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><MapPin className="size-3.5" />AREA OF INTEREST</div>
            <div className="mt-2 text-sm font-medium">{aoi ? aoi.name : "Global search"}</div>
            <div className="mt-1 text-[10px] text-subtle">{aoi ? `${aoi.areaKm2.toFixed(1)} km² · spatial filter enabled` : "No AOI selected"}</div>
          </div>
          <div className="rounded-lg border border-border bg-background/30 p-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Clock3 className="size-3.5" />TIME WINDOW</div>
            <div className="mt-2 font-mono text-sm">{time.start} →</div>
            <div className="font-mono text-sm">{time.end}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {state === "idle" && (
          <div className="rounded-lg border border-dashed border-border p-5 text-center">
            <FileSearch className="mx-auto size-6 text-subtle" />
            <p className="mt-2 text-sm">Connect to the public NASA catalog</p>
            <p className="mt-1 text-xs text-muted-foreground">Load collections to discover the NISAR products currently indexed by CMR.</p>
          </div>
        )}
        {state === "loading" && <div role="status" className="py-6 text-center text-xs text-muted-foreground">Requesting collection metadata from NASA CMR…</div>}
        {state === "error" && <div role="alert" className="rounded-lg border border-alert/40 bg-alert/5 p-3 text-xs text-alert">{error}</div>}
        {state === "partial" && error && <div role="status" className="rounded-lg border border-amber/30 bg-amber/5 p-3 text-xs text-amber">Some product searches did not finish: {error}</div>}

        {(state === "ready" || state === "partial") && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">Showing {visible.length} of {filtered.length} loaded collections ({hits.toLocaleString()} matches reported)</div>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
                <input aria-label="Filter NISAR collections" value={query} onChange={(event) => { setQuery(event.target.value); setShowAll(false); }} placeholder="Filter by product, level, keyword…" className="instrument-input w-full pl-9" />
              </div>
            </div>

            {filtered.length === 0 && <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No loaded collection matches that search term.</p>}

            <div className="grid gap-3 xl:grid-cols-2">
              {visible.map((collection) => {
                const isSelected = collection.conceptId === selectedId;
                return (
                  <article key={collection.conceptId} className={cn("rounded-lg border p-3 transition-colors sm:p-4", isSelected ? "border-primary/60 bg-primary/[0.04]" : "border-border bg-background/25 hover:border-primary/30")}>
                    <button type="button" aria-pressed={isSelected} onClick={() => { setSelectedId(collection.conceptId); setGranules([]); setGranuleState("idle"); setGranuleError(null); }} className="block w-full text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="break-words font-mono text-[11px] text-primary">{collection.shortName}</div>
                          <h3 className="mt-1 text-sm font-medium leading-snug">{collection.title}</h3>
                        </div>
                        <span className="shrink-0 rounded border border-border px-2 py-1 font-mono text-[9px] text-muted-foreground">{collection.processingLevel || "LEVEL N/A"}</span>
                      </div>
                      <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{collection.abstract || "No abstract was supplied in the CMR record."}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] text-subtle">
                        <span>VERSION {collection.version || "—"}</span>
                        <span>{formatDate(collection.startDate)} — {formatDate(collection.endDate)}</span>
                      </div>
                    </button>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                      <div className="flex flex-wrap gap-3">
                        <SourceLink href={collection.metadataUrl}>CMR metadata</SourceLink>
                        <SourceLink href={collection.earthdataSearchUrl}>Earthdata Search</SourceLink>
                      </div>
                      {isSelected && <span className="label-xs text-primary">SELECTED</span>}
                    </div>
                  </article>
                );
              })}
            </div>
            {filtered.length > 8 && <button type="button" onClick={() => setShowAll((value) => !value)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              {showAll ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {showAll ? "Show fewer collections" : `Show all ${filtered.length} collections`}
            </button>}

            <div className="rounded-lg border border-primary/25 bg-primary/[0.035] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="label-xs text-primary">GRANULE DISCOVERY</div>
                  <h3 className="mt-1 text-sm font-medium">{selected?.title ?? "Select a collection"}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {aoi
                      ? "Search the selected collection for granules intersecting your AOI and timeline window."
                      : "Search the selected collection for granules in your timeline window. Draw or upload an AOI in Analyze to add a spatial bounding-box filter."}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-subtle">DATE RANGE · {time.start} TO {time.end}</p>
                </div>
                <button type="button" onClick={() => void loadGranules()} disabled={!selected || granuleState === "loading"} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-primary/40 px-3 text-xs text-primary transition-colors hover:bg-primary/10 disabled:opacity-50">
                  <Search className={cn("size-3.5", granuleState === "loading" && "animate-pulse")} />
                  {granuleState === "loading" ? "SEARCHING GRANULES" : "SEARCH GRANULES"}
                </button>
              </div>
              {granuleError && <p role="alert" className="mt-3 rounded border border-alert/40 bg-alert/5 p-3 text-xs text-alert">{granuleError}</p>}
              {granuleState === "loading" && <p role="status" className="mt-3 text-xs text-muted-foreground">Searching NASA CMR for granule metadata…</p>}
              {granuleState === "ready" && (
                <div className="mt-4">
                  <div className="mb-2 text-xs text-muted-foreground">{granules.length} granules shown · {granuleHits.toLocaleString()} matches reported by CMR</div>
                  {granules.length === 0 && <p className="rounded border border-border p-3 text-xs text-muted-foreground">No granules matched this collection, AOI and date range. Try widening the date window or removing the AOI.</p>}
                  <div className="space-y-2">
                    {granules.map((granule) => <div key={granule.conceptId} className="flex flex-wrap items-start gap-3 rounded-md border border-border bg-background/40 p-3">
                      {granule.browseUrl && <a href={granule.browseUrl} target="_blank" rel="noopener noreferrer" className="block h-20 w-24 shrink-0 overflow-hidden rounded border border-border bg-background"><img src={granule.browseUrl} alt={`NISAR ${granule.productCode} browse preview`} loading="lazy" className="h-full w-full object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} /></a>}
                      <div className="min-w-0 flex-1">
                        <div className="break-all font-mono text-[10px] text-foreground">{granule.granuleId}</div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{formatDate(granule.startDate)}{granule.endDate ? ` — ${formatDate(granule.endDate)}` : ""}{granule.producer ? ` · ${granule.producer}` : ""}</div>
                        {granule.bounds && <div className="mt-1 text-[9px] text-subtle">BOUNDS {granule.bounds.west.toFixed(2)}, {granule.bounds.south.toFixed(2)} → {granule.bounds.east.toFixed(2)}, {granule.bounds.north.toFixed(2)}</div>}
                        <div className="mt-2 flex flex-wrap gap-3">
                          <SourceLink href={granule.metadataUrl}>Metadata</SourceLink>
                          <SourceLink href={granule.earthdataSearchUrl}>Open product</SourceLink>
                          {granule.dataUrl && <SourceLink href={granule.dataUrl}>Data URL</SourceLink>}
                        </div>
                      </div>
                    </div>)}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <footer className="border-t border-border bg-background/30 px-4 py-3 sm:px-5">
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          <strong className="font-medium text-foreground">Metadata only.</strong> Collection and granule identifiers come from NASA CMR. Granule metadata does not mean the raster is freely downloadable from this browser; some products or access methods require an Earthdata Login. No NISAR raster has been fetched, visualized, or processed by this catalog.
        </p>
      </footer>
    </section>
  );
}
