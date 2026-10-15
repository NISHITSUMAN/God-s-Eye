// Frontend-side simulated Third Eye agent.
// Each intent maps to "tool" calls (flyTo, setLayer, searchObservations...) that drive app state.
// Swap `runCommand` for a real tool-calling backend later; keep the same step/message contract.
import { useApp, visibleEvents } from "./store";
import { EVENTS, LOCATIONS, PHENOMENA, phenomenonLabel, type Phenomenon } from "./mock-data";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2);

const KEYWORDS: Record<string, Phenomenon> = {
  fire: "fire", fires: "fire", wildfire: "fire", flood: "flood", floods: "flood", forest: "forest",
  agriculture: "agriculture", crop: "agriculture", soil: "soil", moisture: "soil", landslide: "landslide",
  landslides: "landslide", volcano: "volcano", earthquake: "earthquake", glacier: "glacier", ice: "glacier",
  subsidence: "subsidence", deformation: "subsidence", coastal: "coastal", urban: "urban",
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

  // "biggest / strongest one" → refers to current results
  if (/(biggest|largest|strongest|most severe)/.test(q)) {
    await runSteps("RANKING CURRENT RESULTS", ["Reading current investigation", "Ranking by severity", "Focusing globe"]);
    const list = visibleEvents(useApp.getState()).sort((a, b) => b.severity - a.severity);
    const top = list[0];
    if (!top) return reply("No candidates in the current view. Try widening the filter.");
    useApp.getState().select(top.id);
    return reply(`Selected the most severe candidate: ${top.title.toLowerCase()} in ${top.region} (${top.metric}). Confidence: ${top.confidence.toLowerCase()}.`, [{ label: "Show evidence", run: "explain" }]);
  }

  if (/explain|what am i looking|what is this/.test(q)) {
    const sel = EVENTS.find((e) => e.id === useApp.getState().selectedId);
    await runSteps("INTERPRETING", ["Reading selection", "Summarising evidence"]);
    if (!sel) return reply("Nothing is selected. The globe shows illustrative candidate events by phenomenon; select a marker to inspect it.");
    return reply(`${sel.title} — ${sel.region}. ${sel.interpretation} Evidence: ${sel.evidence.map((e) => `${e.source} (${e.strength.toLowerCase()})`).join(", ")}. This is a candidate, not a confirmed event.`);
  }

  if (/report/.test(q)) {
    await runSteps("PREPARING REPORT", ["Collecting selection", "Assembling evidence", "Formatting summary"]);
    return reply("A draft report is ready for the current investigation. Export will be available once the reporting service is connected.", [{ label: "View results", run: "noop" }]);
  }

  if (/compare|last year|before|after/.test(q)) {
    await runSteps("COMPARING PERIODS", ["Identifying reference period", "Searching NISAR observations", "Differencing acquisitions", "Preparing result"]);
    return reply("Comparison staged with the equivalent period from last year. Use the timeline handles to scrub between acquisitions. (Demo data)");
  }

  if (type || loc) {
    const st = useApp.getState();
    const prevTypes = st.filter.types;
    const types = type ? [type] : prevTypes;
    const region = regionWord ?? (/(only|just)/.test(q) ? st.filter.region : st.filter.region);
    await runSteps(`ANALYZING ${(regionWord ?? "EARTH").toUpperCase()}`, [
      loc ? "Location identified" : "Global scope",
      "NISAR observations found",
      type ? `Applying ${phenomenonLabel(type)} layer` : "Keeping current layers",
      "Cross-checking supporting data",
      "Preparing result",
    ]);
    if (type) useApp.getState().toggleLayer(type, true);
    useApp.getState().setFilter({ types: types ?? null, region: region && region !== "India" ? region : region });
    useApp.getState().setMonth(11);
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
