import { lazy, Suspense, useState } from "react";
import { ClientOnly, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { sampleDataProvider, severityBand } from "@/lib/earth-data";
import { useApp, visibleEvents } from "@/lib/store";
import { Metadata } from "./ScientificViews";
const EarthMap=lazy(()=>import('./EarthMap'));const EarthGlobe=lazy(()=>import('./EarthGlobe'));
export function ObservationCatalog() {
  const nav = useNavigate();
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState("");
  const [quality, setQuality] = useState("");
  const [orbit, setOrbit] = useState("");
  const [polarization, setPolarization] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [page, setPage] = useState(0);
  const all = sampleDataProvider.observations();
  const nisarGranules = useApp(state => state.nisarGranules);
  const nisarHits = useApp(state => state.nisarGranuleHits);
  const nisarStatus = useApp(state => state.nisarStatus);
  const nisarError = useApp(state => state.nisarError);
  const nisarRows = nisarGranules.filter((granule) => {
    const day = (granule.startDate || "").slice(0, 10);
    return (!query || `${granule.granuleId} ${granule.productCode} ${granule.collectionShortName}`.toLowerCase().includes(query.toLowerCase()))
      && (!product || granule.productCode === product || granule.collectionShortName.includes(product))
      && (!start || (day && day >= start))
      && (!end || (day && day <= end));
  });
  const rows = all.filter(o =>
    (o.id + o.region).toLowerCase().includes(query.toLowerCase())
    && (!product || o.product === product)
    && (!quality || o.quality === quality)
    && (!orbit || o.orbit === orbit)
    && (!polarization || o.polarization === polarization)
    && (!start || o.date >= start)
    && (!end || o.date <= end),
  );

  return <>
    <section className="scientific-band mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label-xs text-primary">REAL DATA · NASA EARTHDATA / ASF</div>
          <h2 className="mt-2 text-lg">Live NISAR acquisitions</h2>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Acquisition records and browse links below are retrieved from NASA's Common Metadata Repository. Select a record to inspect its real product metadata and focus its coverage on the map. A browse image is a preview, not the full radar raster.
          </p>
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">{nisarStatus.toUpperCase()} · {nisarRows.length} SHOWN / {nisarHits.toLocaleString()} MATCHES</div>
      </div>
      {nisarError && <p role="status" className="mt-3 text-xs text-amber">{nisarError}</p>}
      {nisarRows.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {nisarRows.slice(0, 24).map((granule) => (
            <article key={granule.conceptId} className="flex min-w-0 gap-3 rounded-lg border border-border bg-background/30 p-3">
              {granule.browseUrl ? (
                <a href={granule.browseUrl} target="_blank" rel="noopener noreferrer" className="block h-24 w-28 shrink-0 overflow-hidden rounded border border-border bg-background">
                  <img src={granule.browseUrl} alt={`NISAR ${granule.productCode} browse preview`} loading="lazy" className="h-full w-full object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                </a>
              ) : <div className="flex h-24 w-28 shrink-0 items-center justify-center rounded border border-border bg-background font-mono text-[9px] text-subtle">NO PREVIEW</div>}
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] text-primary">{granule.productCode} · {granule.startDate?.slice(0, 10) ?? "DATE N/A"}</div>
                <div className="mt-1 break-all text-[10px] leading-snug">{granule.granuleId}</div>
                <div className="mt-2 flex flex-wrap gap-3">
                  <Link to="/observations/$id" params={{ id: granule.id }} className="text-[11px] text-primary hover:underline">Inspect record</Link>
                  <a href={granule.earthdataSearchUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline">Earthdata ↗</a>
                  <button type="button" onClick={() => { useApp.getState().select(granule.id); nav({ to: "/" }); }} className="text-[11px] text-primary hover:underline">View coverage</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
          {nisarStatus === "loading" ? "Searching current NASA NISAR catalog records…" : nisarStatus === "error" ? "Live NISAR metadata could not be loaded. Check network access or retry from Data Explorer." : "No matching granules are currently loaded for the default India area and date window. Widen the search or open Data Explorer to search another area."}
        </div>
      )}
      <p className="mt-3 font-mono text-[9px] leading-relaxed text-subtle">SOURCE: NASA CMR / ASF DAAC · MAP FOOTPRINTS ARE CATALOG SPATIAL EXTENTS · FULL PRODUCT ACCESS MAY REQUIRE EARTHDATA LOGIN</p>
    </section>

    <section className="scientific-band">
      <div className="label-xs text-amber">ILLUSTRATIVE SAMPLE OBSERVATIONS</div>
      <p className="mt-2 text-xs text-muted-foreground">The table below is the original demonstration catalog. These rows and their NISAR-like IDs/geometry are examples, not actual satellite acquisitions.</p>
    </section>
    <div className="mb-5 flex flex-wrap gap-2">
      <input aria-label="Search sample observations" placeholder="Search sample ID or region" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} className="instrument-input" />
      {([
        ["Product", product, setProduct, all.map(o => o.product)],
        ["Orbit", orbit, setOrbit, all.map(o => o.orbit)],
        ["Polarization", polarization, setPolarization, all.map(o => o.polarization)],
        ["Quality", quality, setQuality, ["Nominal", "Degraded", "Processing"]],
      ] as const).map(([label, value, set, options]) => (
        <select key={label} aria-label={label} value={value} onChange={e => { set(e.target.value); setPage(0); }} className="instrument-select">
          <option value="">{label}: ALL</option>
          {[...new Set(options)].map(o => <option key={o}>{o}</option>)}
        </select>
      ))}
      <input aria-label="Sample observation date start" type="date" value={start} onChange={e => { setStart(e.target.value); setPage(0); }} className="instrument-input" />
      <input aria-label="Sample observation date end" type="date" value={end} onChange={e => { setEnd(e.target.value); setPage(0); }} className="instrument-input" />
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead><tr>{["Sample observation", "Product", "Acquisition", "Orbit", "Polarization", "Region", "Quality"].map(h => <th key={h} scope="col" className="label-xs border-b border-border px-3 py-3">{h}</th>)}</tr></thead>
        <tbody>{rows.slice(page * 8, page * 8 + 8).map(o => (
          <tr key={o.id} className="border-b border-border hover:bg-elevated">
            <td className="px-3 py-4"><Link to="/observations/$id" params={{ id: o.id }} className="font-mono text-primary">{o.id}</Link></td><td>{o.product}</td><td>{o.date}</td><td>{o.orbit}</td><td>{o.polarization}</td><td>{o.region}</td><td>{o.quality}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
    {!rows.length && <div className="scientific-band"><h2 className="label-xs">NO SAMPLE OBSERVATIONS FOUND</h2><p className="my-3 text-sm text-muted-foreground">No illustrative example matches those filters.</p><Button variant="outline" onClick={() => { setQuery(""); setProduct(""); setQuality(""); setOrbit(""); setPolarization(""); setStart(""); setEnd(""); }}>CHANGE FILTERS</Button></div>}
    <div className="mt-4 flex items-center justify-between"><span className="label-xs">{rows.length} sample observations</span><div className="flex gap-2"><Button variant="ghost" size="sm" disabled={!page} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="ghost" size="sm" disabled={(page + 1) * 8 >= rows.length} onClick={() => setPage(page + 1)}>Next</Button></div></div>
  </>;
}
export function EventCatalog(){const nav=useNavigate();const filter=useApp(s=>s.filter);const layers=useApp(s=>s.layers);const time=useApp(s=>s.time);const lod=useApp(s=>s.lod);const [mode,setMode]=useState('LIST');const [query,setQuery]=useState('');const [start,setStart]=useState('');const [end,setEnd]=useState('');const liveEvents=useApp(s=>s.liveEvents);const liveRows=liveEvents.filter(e=>{const day=e.date.slice(0,10);return layers.has(e.layerId)&&(!filter.types||filter.types.includes(e.type))&&(!filter.region||(`${e.region} ${e.country}`).toLowerCase().includes(filter.region.toLowerCase()))&&day>=time.start&&day<=time.end&&day<=time.current&&(!start||day>=start)&&(!end||day<=end)&&(e.title+e.region+e.source).toLowerCase().includes(query.toLowerCase());});const rows=visibleEvents({layers,filter,time,lod}).filter(e=>(e.title+e.region+e.country).toLowerCase().includes(query.toLowerCase())&&(!start||e.date>=start)&&(!end||e.date<=end));return <><div className="mb-5 flex flex-wrap gap-2">{['LIST','MAP','GLOBE'].map(m=><Button key={m} size="sm" variant={mode===m?'secondary':'ghost'} onClick={()=>setMode(m)}>{m}</Button>)}<input aria-label="Search events geography" placeholder="Event or geography" value={query} onChange={e=>setQuery(e.target.value)} className="instrument-input"/><select aria-label="Event phenomenon" className="instrument-select" value={filter.types?.[0]??''} onChange={e=>useApp.getState().setFilter({types:e.target.value?[sampleDataProvider.phenomena().find(p=>p.id===e.target.value)?.id??'fire']:null})}><option value="">All phenomena</option>{sampleDataProvider.phenomena().map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select><select aria-label="Event confidence" value={filter.confidence} onChange={e=>useApp.getState().setFilter({confidence:e.target.value as typeof filter.confidence})} className="instrument-select"><option value="all">Confidence: ALL</option><option value="high">HIGH</option><option value="moderate+">MODERATE+</option><option value="low+">LOW+</option></select><input aria-label="Event start date" type="date" value={start} onChange={e=>setStart(e.target.value)} className="instrument-input"/><input aria-label="Event end date" type="date" value={end} onChange={e=>setEnd(e.target.value)} className="instrument-input"/></div>{mode!=='LIST'?<div className="relative h-[540px]"><ClientOnly><Suspense fallback={<div>LOADING EARTH</div>}>{mode==='MAP'?<EarthMap compact/>:<EarthGlobe/>}</Suspense></ClientOnly></div>:<div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{['Event','Location','Date','Metric','Severity','Confidence','Stage'].map(h=><th key={h} scope="col" className="label-xs border-b border-border py-3">{h}</th>)}</tr></thead><tbody>{rows.map(e=><tr key={e.id} className="border-b border-border hover:bg-elevated"><td className="py-3"><Button variant="link" className="h-auto px-0 text-xs" onClick={()=>{useApp.getState().select(e.id);nav({to:'/'});}}>{e.title}</Button></td><td>{e.region}</td><td>{e.date}</td><td>{e.metric}</td><td>{severityBand(e.severity).toUpperCase()}</td><td>{e.confidence}</td><td>{e.stage.toUpperCase()}</td></tr>)}{liveRows.map(e=><tr key={e.id} className="border-b border-border bg-primary/[0.025] hover:bg-elevated"><td className="py-3"><Button variant="link" className="h-auto px-0 text-xs" onClick={()=>{useApp.getState().select(e.id);nav({to:'/'});}}>{e.title} · LIVE</Button></td><td>{e.region}</td><td>{e.date.slice(0,10)}</td><td>{e.metric}</td><td>SOURCE REPORT</td><td>Not assessed</td><td>{e.source}</td></tr>)}</tbody></table></div>}{!rows.length&&!liveRows.length&&<p className="my-5 text-sm text-muted-foreground">NO EVENTS FOUND — widen filters or time range, or enable a live feed in Layers.</p>}</>;}
export function DiscoverFindings(){return <div>{[...sampleDataProvider.events()].sort((a,b)=>b.severity-a.severity).slice(0,9).map(e=><section key={e.id} className="scientific-band grid gap-5 sm:grid-cols-[140px_1fr_auto]"><div className="border border-border p-3"><svg viewBox="0 0 120 80" role="img" aria-label={`Sample geometry for ${e.region}`}><path d="M5 65L25 25L48 10L78 20L110 45L85 70L40 75Z" fill="var(--primary)" fillOpacity=".1" stroke="var(--primary)"/><circle cx="60" cy="40" r="3" fill="var(--amber)"/><path d="M0 76H120" stroke="var(--border)"/></svg><span className="label-xs text-[8px]">SAMPLE GEOMETRY</span></div><div><Link to="/intelligence/$phenomenon" params={{phenomenon:e.type}} className="label-xs text-primary">{e.type}</Link><h2 className="mt-2 text-lg">{e.title} · {e.region}</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">{e.interpretation}</p><div className="mt-3 font-mono text-[10px] text-subtle">{e.date} · {e.confidence.toUpperCase()} CONFIDENCE · SAMPLE</div></div><div className="font-mono text-xl">{e.metric}</div></section>)}</div>;}
