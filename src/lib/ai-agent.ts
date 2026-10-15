// Frontend-side simulated Third Eye agent.
// Each intent maps to "tool" calls (flyTo, setLayer, searchObservations...) that drive app state.
// Swap `runCommand` for a real tool-calling backend later; keep the same step/message contract.
import { useApp, visibleEvents } from "./store";
import { EVENTS, LOCATIONS, PHENOMENA, phenomenonLabel, type Phenomenon } from "./mock-data";
import { DATASETS, sampleDataProvider } from "./earth-data";
import { ANALYSIS_CATALOG, rectangleAOI } from "./analysis";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2);

const NISAR_PRODUCT_CODES = ["GCOV", "GSLC", "GUNW", "GOFF", "RSLC", "RIFG", "ROFF", "RUNW", "SME2"];

const NISAR_FOCUS_REGIONS = [
  {
    name: "Jammu & Kashmir · India-aligned boundary view",
    keywords: ["jammu", "kashmir"],
    bounds: [72.2, 32.1, 77.7, 37.3] as [number, number, number, number],
    lat: 34,
    lng: 74.8,
    altitude: 0.07,
  },
  {
    name: "Ladakh · India-aligned boundary view",
    keywords: ["ladakh", "leh"],
    bounds: [74.9, 31.9, 81, 36.5] as [number, number, number, number],
    lat: 34.4,
    lng: 78.1,
    altitude: 0.09,
  },
  {
    name: "Kashmir region · India-aligned boundary view",
    keywords: ["kashmir region", "greater kashmir"],
    bounds: [72, 31.8, 81.2, 37.8] as [number, number, number, number],
    lat: 34.4,
    lng: 76.2,
    altitude: 0.18,
  },
];

const KEYWORDS: Record<string, Phenomenon> = {
  fire: "fire", fires: "fire", wildfire: "fire", wildfires: "fire", flood: "flood", floods: "flood", flooding: "flood", forest: "forest",
  agriculture: "agriculture", crop: "agriculture", crops: "agriculture", soil: "soil", moisture: "soil", landslide: "landslide",
  landslides: "landslide", volcano: "volcano", volcanoes: "volcano", earthquake: "earthquake", earthquakes: "earthquake", glacier: "glacier", glaciers: "glacier", ice: "glacier",
  subsidence: "subsidence", deformation: "subsidence", coastal: "coastal", coast: "coastal", urban: "urban",
};

async function runSteps(title: string, labels: string[]) {
  const { setSteps } = useApp.getState();
  for (let i = 0; i <= labels.length; i++) {
    setSteps(title, labels.map((l, j) => ({ label: l, status: j < i ? "done" : j === i ? "active" : "pending" })));
    await wait(520);
  }
}

export async function runCommand(raw: string) {
  const s = useApp.getState();
  const text = raw.trim();
  if (!text) return;
  s.setAIActive(true);
  s.pushMessage({ id: uid(), role: "user", text });
  const q = text.toLowerCase();

  const type = Object.entries(KEYWORDS).find(([k]) => new RegExp(`\\b${k}\\b`).test(q))?.[1];
  const loc = LOCATIONS.find((l) => q.includes(l.name.toLowerCase()));
  const regionWord = loc?.name ?? null;

  const focusRegion = NISAR_FOCUS_REGIONS.find(region =>
    region.keywords.some(keyword => q.includes(keyword)),
  );
  const productCode = NISAR_PRODUCT_CODES.find(code =>
    new RegExp(\`\\b\${code.toLowerCase()}\\b\`).test(q),
  );
  const nisarIntent = /\b(nisar|coverage|satellite|acquisition|granule|radar|product|swath)\b/.test(q);

  // Regional commands focus the real catalogue/map, never a synthetic hazard layer.
  if (focusRegion) {
    const app = useApp.getState();
    const [west, south, east, north] = focusRegion.bounds;
    const aoi = rectangleAOI([west, south], [east, north]);
    app.setAOI({ ...aoi, name: focusRegion.name });
    app.flyTo({ lat: focusRegion.lat, lng: focusRegion.lng, altitude: focusRegion.altitude });
    app.toggleLayer("nisar-coverage", true);
    const requestedProducts = productCode ? [productCode] : app.nisarSelectedProductCodes;
    for (const code of requestedProducts) app.toggleLayer(\`prod-\${code}\`, true);

    await runSteps("SEARCHING REAL NISAR COVERAGE", [
      "Focusing the India-aligned regional boundary",
      "Setting the geographic search area",
      "Querying NASA's public NISAR catalogue",
    ]);
    void useApp.getState().refreshNISARData(requestedProducts);
    return reply(
      \`Focused on \${focusRegion.name}. A NASA CMR search has started for \${productCode ?? "the selected NISAR product families"}. Returned footprints are real catalogue coverage when available; they are not by themselves flood, fire, landslide or deformation detections.\`,
      [{ label: "Open NISAR data explorer", run: "navigate:/data" }, { label: "Open observations", run: "navigate:/observations" }],
    );
  }

  if (productCode && (nisarIntent || /\b(show|find|search|latest|recent|open)\b/.test(q))) {
    const app = useApp.getState();
    app.toggleLayer("nisar-coverage", true);
    app.toggleLayer(\`prod-\${productCode}\`, true);
    void app.refreshNISARData([productCode]);
    return reply(
      \`Searching NASA CMR for real NISAR \${productCode} acquisitions in the current area and date range. This view uses published catalogue metadata and source-provided footprint geometry; full-resolution raster processing is not run in this frontend.\`,
      [{ label: "Open data explorer", run: "navigate:/data" }],
    );
  }

  if (nisarIntent && /\b(latest|newest|recent)\b/.test(q)) {
    const app = useApp.getState();
    const newest = [...app.nisarGranules]
      .filter(granule => !productCode || granule.productCode === productCode)
      .sort((a, b) => (Date.parse(b.startDate || "") || 0) - (Date.parse(a.startDate || "") || 0))[0];
    if (newest) {
      app.select(newest.id);
      return reply(
        \`Selected the latest loaded NISAR catalogue record: \${newest.productCode}, \${newest.startDate?.slice(0, 10) ?? "date not reported"}. This is a real acquisition record, not a processed change-detection result.\`,
        [{ label: "Inspect acquisition", run: "navigate:/observations" }, { label: "Open data explorer", run: "navigate:/data" }],
      );
    }
    void app.refreshNISARData(productCode ? [productCode] : undefined);
    return reply("I have started a NASA CMR search for recent NISAR products. Matching records will appear in the Data Explorer.");
  }

  if (/\b(dataset|datasets|product code|available products|list products|gcov|gunw|gslc|goff|sme2|rslc|rifg|runw|roff)\b/.test(q)) {
    const matching = DATASETS.filter(dataset =>
      q.includes(dataset.id.toLowerCase()) || q.includes(dataset.name.toLowerCase()) ||
      /\b(dataset|datasets|available products|list products)\b/.test(q)
    );
    if (matching.length) {
      const summary = matching.map(dataset => `${dataset.name} — ${dataset.availability.toLowerCase()}`).join("; ");
      return reply(`Dataset catalog: ${summary}. NASA CMR is connected for real NISAR acquisition metadata, browse previews and spatial coverage. Full-resolution raster download and scientific change detection are not implemented in this frontend.`, [{ label: "Open data catalog", run: "navigate:/data" }]);
    }
  }

  if (/\b(metadata|acquisition|observation details|product details)\b/.test(q)) {
    const state = useApp.getState();
    const nisar = state.nisarGranules.find(granule =>
      granule.id === state.selectedId ||
      q.includes(granule.granuleId.toLowerCase()) ||
      q.includes(granule.conceptId.toLowerCase()),
    );
    if (nisar) {
      return reply(`Real NISAR catalogue record: ${nisar.productCode}; acquisition ${nisar.startDate?.slice(0, 19) ?? "date not reported"}; collection ${nisar.collectionShortName}; producer ${nisar.producer || "NASA CMR / ASF"}. Spatial coverage uses ${nisar.footprint ? "the CMR polygon footprint" : nisar.bounds ? "the CMR bounding rectangle" : "no supplied footprint"}. This is acquisition metadata, not a derived hazard detection.`, [{ label: "Open observations", run: "navigate:/observations" }, { label: "Open data explorer", run: "navigate:/data" }]);
    }
    const liveEvent = state.liveEvents.find(event => event.id === state.selectedId || q.includes(event.sourceId.toLowerCase()) || q.includes(event.title.toLowerCase()));
    if (liveEvent) return reply(`Live record ${liveEvent.title}: ${liveEvent.date}; ${liveEvent.metricLabel}: ${liveEvent.metric}; ${liveEvent.summary}. Source: ${liveEvent.sourceLabel}. No NISAR acquisition metadata is implied.`);
    const selectedEvent = sampleDataProvider.events().find(event =>
      event.id === state.selectedId ||
      q.includes(event.id.toLowerCase()) ||
      q.includes(event.observationId.toLowerCase()) ||
      q.includes(event.title.toLowerCase())
    );
    const observation = sampleDataProvider.observations().find(item =>
      q.includes(item.id.toLowerCase()) || item.id === selectedEvent?.observationId
    );
    if (observation) {
      return reply(`Sample observation ${observation.id}: ${observation.product}, ${observation.date}, ${observation.region}, ${observation.band}, ${observation.polarization}, ${observation.resolution}. Status: ${observation.status}. This is illustrative catalog metadata, not a retrieved NISAR acquisition.`);
    }
    if (selectedEvent) {
      return reply(`Sample candidate ${selectedEvent.id}: ${selectedEvent.title}, ${selectedEvent.region}, ${selectedEvent.date}; severity ${selectedEvent.severity}; confidence ${selectedEvent.confidence}. Interpretation: ${selectedEvent.interpretation} This record and its geometry are illustrative, not a verified event.`);
    }
    return reply("Select a real NISAR acquisition from the map or Data Explorer, or search for GCOV, GSLC, GUNW or SME2. NASA CMR metadata is connected; the full radar raster still requires a separate data-download and processing stage.", [{ label: "Open data explorer", run: "navigate:/data" }]);
  }

  // "biggest / strongest one" → refers to current results
  if (/(biggest|largest|strongest|most severe)/.test(q)) {
    await runSteps("RANKING CURRENT RESULTS", ["Reading the current filters", "Ranking available records", "Focusing the globe"]);
    const state = useApp.getState();
    const sample = visibleEvents(state).sort((a, b) => b.severity - a.severity);
    const live = state.liveEvents.filter((event) => {
      const day = event.date.slice(0, 10);
      return state.layers.has(event.layerId) &&
        (!state.filter.types || state.filter.types.includes(event.type)) &&
        (!state.filter.region || `${event.region} ${event.country}`.toLowerCase().includes(state.filter.region.toLowerCase())) &&
        day >= state.time.start && day <= state.time.end && day <= state.time.current;
    });
    const liveQuakes = live.filter((event) => event.source === "USGS" && event.type === "earthquake")
      .sort((left, right) => Number(right.metric.match(/\\d+(?:\\.\\d+)?/)?.[0] ?? -1) - Number(left.metric.match(/\\d+(?:\\.\\d+)?/)?.[0] ?? -1));
    const topLive = (/(earthquake|earthquakes|usgs|live)/.test(q) || state.liveEvents.some((event) => event.id === state.selectedId))
      ? liveQuakes[0]
      : undefined;
    if (topLive) {
      state.select(topLive.id);
      return reply(`Selected the highest reported magnitude among the currently loaded USGS records: ${topLive.title} (${topLive.metric}). This compares reported magnitude only; it is not a hazard or damage ranking.`);
    }
    const top = sample[0];
    if (!top) return reply("No candidates in the current view. Enable a live source or widen the filters.");
    state.select(top.id);
    return reply(`Selected the highest-severity illustrative candidate: ${top.title.toLowerCase()} in ${top.region} (${top.metric}). Confidence shown belongs to the sample record, not a live hazard prediction.`, [{ label: "Show evidence", run: "explain" }]);
  }

  if (/explain|what am i looking|what is this/.test(q)) {
    const state = useApp.getState();
    const nisar = state.nisarGranules.find((granule) => granule.id === state.selectedId);
    const live = state.liveEvents.find((event) => event.id === state.selectedId);
    const sel = EVENTS.find((event) => event.id === state.selectedId);
    await runSteps("INTERPRETING", ["Reading the selected record", "Summarising source metadata"]);
    if (nisar) return reply(`Real NISAR ${nisar.productCode} acquisition from ${nisar.startDate?.slice(0, 10) ?? "an unreported date"}. Collection: ${nisar.collectionShortName}. The map outline is catalogue-provided coverage; it is not a processed hazard map or a change-detection result.`, [{ label: "Inspect metadata", run: "navigate:/observations" }, { label: "Open data explorer", run: "navigate:/data" }]);
    if (live) return reply(`${live.title} — ${live.region}. ${live.summary} Source: ${live.sourceLabel}. This is a source-reported event, not a NISAR measurement or a Third Eye prediction. Open its source record from the context panel to inspect the publisher's details.`);
    if (!sel) return reply("Nothing is selected. Select an illustrative candidate or enable a public data layer and select a live source marker.");
    return reply(`${sel.title} — ${sel.region}. ${sel.interpretation} Evidence: ${sel.evidence.map((e) => `${e.source} (${e.strength.toLowerCase()})`).join(", ")}. This is illustrative sample data, not a confirmed event.`);
  }

  if (/report/.test(q)) {
    await runSteps("PREPARING REPORT", ["Collecting selection", "Assembling evidence", "Formatting summary"]);
    return reply("The report builder can create a clearly marked sample PDF for the current investigation. It will not contain processed NISAR measurements because no scientific data service is connected.", [{ label: "Open report builder", run: "navigate:/reports/create" }]);
  }

  if (/compare|last year|before|after/.test(q)) {
    await runSteps("STAGING A SAMPLE COMPARISON", ["Reading the current time range", "Keeping the current investigation context", "Preparing comparison controls"]);
    useApp.getState().setInvestigation({ comparison: "before-after" });
    return reply("Before/after comparison mode is enabled, but no image differencing has been run. The timeline and sample overlays are for interface demonstration only.");
  }

  if (type || loc) {
    const st = useApp.getState();
    const prevTypes = st.filter.types;
    const types = type ? [type] : prevTypes;
    const region = regionWord ?? st.filter.region;
    await runSteps(`ANALYZING ${(regionWord ?? "EARTH").toUpperCase()}`, [
      loc ? "Location identified" : "Global scope",
      "Filtering illustrative sample records",
      type ? `Enabling the ${phenomenonLabel(type)} layer` : "Keeping current layers",
      "Preserving source and uncertainty labels",
      "Updating the map and investigation context",
    ]);
    if (type) useApp.getState().toggleLayer(type, true);
    useApp.getState().setFilter({ types: types ?? null, region: region && region !== "India" ? region : region });
    if (loc) useApp.getState().flyTo({ lat: loc.lat, lng: loc.lng, altitude: loc.kind === "Country" ? 1.1 : 0.02 });
    const n = visibleEvents(useApp.getState()).length;
    const label = types ? types.map(phenomenonLabel).join(", ").toLowerCase() : "change";
    return reply(
      n
        ? `I found ${n} ${label} candidate${n > 1 ? "s" : ""}${region ? ` in ${region}` : ""}. Results are illustrative demo data.`
        : `No ${label} candidates found${region ? ` in ${region}` : ""} in the demo dataset.`,
      [{ label: "Show the biggest", run: "Show the biggest one" }, { label: "Clear filter", run: "clear" }],
    );
  }

  if (/\b(analy[sz]e|run analysis|draw an area|area of interest|aoi)\b/.test(q)) {
    return reply(`The analysis workspace can query real NASA CMR NISAR acquisitions for an area, product and date range. Available analysis methods include: ${ANALYSIS_CATALOG.slice(0, 8).join(", ")}. At present the result is catalogue discovery only; full-resolution raster processing and verified detections require a separate processing backend.`, [{ label: "Open analysis workspace", run: "navigate:/analyze" }]);
  }

  if (/\b(open|go to|show)\s+(the\s+)?(observations|events|datasets|data catalog|discover|methodology|learn)\b/.test(q)) {
    const term = q.match(/\b(observations|events|datasets|data catalog|discover|methodology|learn)\b/)?.[1];
    const route = term === "observations"
      ? "/observations"
      : term === "events"
        ? "/events"
        : term === "datasets"
          ? "/datasets"
          : term === "data catalog"
            ? "/data"
            : "/" + term;
    return reply("Opening the " + term + " section.", [{ label: "Open section", run: "navigate:" + route }]);
  }

  if (/\b(live data|live feeds?|usgs|eonet|public feeds?)\b/.test(q)) {
    const state = useApp.getState();
    return reply(`Live source status: ${state.liveDataStatus.toUpperCase()}. ${state.liveEvents.length} public records are loaded. ${state.liveDataError ?? "Use the live source controls or Data Explorer to refresh USGS and NASA EONET."} These records are separate from the sample-only scientific overlays.`, [{ label: "Open data explorer", run: "navigate:/data" }]);
  }

  if (/clear|reset|all/.test(q)) {
    useApp.getState().setFilter({ types: null, region: null });
    return reply("Filters cleared. Showing all phenomena.");
  }

  await runSteps("INTERPRETING REQUEST", ["Parsing intent"]);
  reply(`I can focus on Kashmir or Ladakh, search real NISAR product metadata, show acquisition coverage, open the data catalog, and separately display clearly marked sample phenomena. Full radar change detection is not performed by this command simulator.`);
}

function reply(text: string, actions?: { label: string; run: string }[]) {
  const s = useApp.getState();
  s.setSteps(null, null);
  s.pushMessage({ id: uid(), role: "system", text, actions });
}
