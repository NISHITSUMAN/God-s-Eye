// Frontend-side simulated Third Eye agent.
// Each intent maps to "tool" calls (flyTo, setLayer, searchObservations...) that drive app state.
// Swap `runCommand` for a real tool-calling backend later; keep the same step/message contract.
import { useApp, visibleEvents } from "./store";
import { EVENTS, LOCATIONS, PHENOMENA, phenomenonLabel, type Phenomenon } from "./mock-data";
import { DATASETS, sampleDataProvider } from "./earth-data";
import { ANALYSIS_CATALOG } from "./analysis";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2);

const KEYWORDS: Record<string, Phenomenon> = {
  fire: "fire", fires: "fire", wildfire: "fire", wildfires: "fire", flood: "flood", floods: "flood", flooding: "flood", forest: "forest",
  agriculture: "agriculture", crop: "agriculture", crops: "agriculture", soil: "soil", moisture: "soil", landslide: "landslide",
  landslides: "landslide", volcano: "volcano", volcanoes: "volcano", earthquake: "earthquake", earthquakes: "earthquake", glacier: "glacier", glaciers: "glacier", ice: "glacier",
  subsidence: "subsidence", deformation: "subsidence", coastal: "coastal", coast: "coastal", urban: "urban,
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

  if (/\b(dataset|datasets|product code|available products|list products|gcov|gunw|gslc|goff|sme2|rslc|rifg|runw|roff)\b/.test(q)) {
    const matching = DATASETS.filter(dataset =>
      q.includes(dataset.id.toLowerCase()) || q.includes(dataset.name.toLowerCase()) ||
      /\b(dataset|datasets|available products|list products)\b/.test(q)
    );
    if (matching.length) {
      const summary = matching.map(dataset => `${dataset.name} — ${dataset.availability.toLowerCase()}`).join("; ");
      return reply(`Dataset catalog: ${summary}. Product descriptions and availability are catalog metadata; no radar products are connected in this build.`, [{ label: "Open data catalog", run: "navigate:/data" }]);
    }
  }

  if (/\b(metadata|acquisition|observation details|product details)\b/.test(q)) {
    const state = useApp.getState();
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
    return reply("Select an event or provide an observation ID to inspect its sample metadata. No live metadata service is connected.");
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
    const live = state.liveEvents.find((event) => event.id === state.selectedId);
    const sel = EVENTS.find((event) => event.id === state.selectedId);
    await runSteps("INTERPRETING", ["Reading the selected record", "Summarising source metadata"]);
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
    if (loc) useApp.getState().flyTo({ lat: loc.lat, lng: loc.lng, altitude: loc.kind === "Country" ? 1.1 : 0.7 });
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
    return reply(`The analysis workspace supports area selection and a sample workflow. Available analysis methods include: ${ANALYSIS_CATALOG.slice(0, 8).join(", ")}. Results remain sample-only until real processing is connected.`, [{ label: "Open analysis workspace", run: "navigate:/analyze" }]);
  }

  if (/\b(open|go to|show)\s+(the\\s+)?(observations|events|datasets|data catalog|discover|methodology|learn)\b/.test(q)) {
    const term = q.match(/\b(observations|events|datasets|data catalog|discover|methodology|learn)\b/)?.[1];
    const route = term === "observations" ? "/observations" : term === "events" ? "/events" : term === "datasets" || term === "data catalog" ? "/data" : `/${term}`;
    return reply(`Opening the ${term} section.`, [{ label: "Open section", run: `navigate:${route}` }]);
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
  reply(`I can search phenomena (${PHENOMENA.slice(0, 5).map((p) => p.label.toLowerCase()).join(", ")}…), fly to places, rank results, compare periods and explain selections.`);
}

function reply(text: string, actions?: { label: string; run: string }[]) {
  const s = useApp.getState();
  s.setSteps(null, null);
  s.pushMessage({ id: uid(), role: "system", text, actions });
}
