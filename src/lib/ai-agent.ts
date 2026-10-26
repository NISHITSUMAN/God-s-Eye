import { useApp } from "./store";
import { rectangleAOI } from "./analysis";

type Action =
  | { type: "fly_to"; lat: number; lng: number; altitude?: number }
  | { type: "set_layer"; layer: string; enabled: boolean }
  | { type: "search_nisar"; region: "India" | "Kashmir" | "Ladakh" | "Global"; productCodes?: string[] }
  | { type: "navigate"; route: string }
  | { type: "refresh_live" };

const PRODUCTS = new Set(["GCOV", "GSLC", "GUNW", "GOFF", "RSLC", "RIFG", "ROFF", "RUNW", "SME2"]);
const LAYERS = new Set(["nisar-coverage", ...[...PRODUCTS].map(code => `prod-${code}`), "live-usgs", "live-eonet"]);
const ROUTES = new Set(["/", "/data", "/analyze", "/observations", "/events", "/discover"]);
const REGIONS: Record<string, { name: string; bounds: [number, number, number, number]; lat: number; lng: number; altitude: number }> = {
  India: { name: "India", bounds: [68, 6, 98, 38], lat: 22.5, lng: 79, altitude: 1.05 },
  Kashmir: { name: "Kashmir region · India-aligned boundary view", bounds: [72, 31.8, 81.2, 37.8], lat: 34.4, lng: 76.2, altitude: 0.18 },
  Ladakh: { name: "Ladakh · India-aligned boundary view", bounds: [74.9, 31.9, 81, 36.5], lat: 34.4, lng: 78.1, altitude: 0.09 },
  Global: { name: "India region", bounds: [68, 6, 98, 38], lat: 22.5, lng: 79, altitude: 1.05 },
};
const uid = () => `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function actionFrom(value: unknown): Action | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const a = value as Record<string, unknown>;
  if (a.type === "fly_to") {
    const lat = Number(a.lat), lng = Number(a.lng), altitude = a.altitude === undefined ? 0.4 : Number(a.altitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(altitude) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && altitude >= 0.002 && altitude <= 5 ? { type: "fly_to", lat, lng, altitude } : null;
  }
  if (a.type === "set_layer" && typeof a.layer === "string" && LAYERS.has(a.layer) && typeof a.enabled === "boolean") return { type: "set_layer", layer: a.layer, enabled: a.enabled };
  if (a.type === "search_nisar" && typeof a.region === "string" && REGIONS[a.region]) {
    const codes = Array.isArray(a.productCodes) ? [...new Set(a.productCodes.filter((v): v is string => typeof v === "string").map(v => v.toUpperCase()))].filter(v => PRODUCTS.has(v)).slice(0, 5) : [];
    return { type: "search_nisar", region: a.region as "India" | "Kashmir" | "Ladakh" | "Global", ...(codes.length ? { productCodes: codes } : {}) };
  }
  if (a.type === "navigate" && typeof a.route === "string" && ROUTES.has(a.route)) return { type: "navigate", route: a.route };
  if (a.type === "refresh_live") return { type: "refresh_live" };
  return null;
}
function execute(action: Action): boolean {
  const s = useApp.getState();
  if (action.type === "fly_to") { s.flyTo({ lat: action.lat, lng: action.lng, altitude: action.altitude ?? 0.4 }); return true; }
  if (action.type === "set_layer") {
    s.toggleLayer(action.layer, action.enabled);
    if (action.layer === "live-usgs" || action.layer === "live-eonet") void useApp.getState().refreshLiveData();
    return true;
  }
  if (action.type === "refresh_live") { void s.refreshLiveData(); return true; }
  if (action.type === "search_nisar") {
    const region = REGIONS[action.region];
    if (action.region === "Global") s.setAOI(null);
    else {
      const [west, south, east, north] = region.bounds;
      s.setAOI({ ...rectangleAOI([west, south], [east, north]), name: region.name });
    }
    s.flyTo({ lat: region.lat, lng: region.lng, altitude: region.altitude });
    s.toggleLayer("nisar-coverage", true);
    const codes = action.productCodes?.length ? action.productCodes : s.nisarSelectedProductCodes;
    codes.forEach(code => s.toggleLayer(`prod-${code}`, true));
    s.setNISARProductSelection(codes);
    void s.refreshNISARData(codes);
    return true;
  }
  return false;
}
export async function runCommand(raw: string) {
  const message = raw.trim();
  if (!message) return;
  const s = useApp.getState();
  s.setAIActive(true);
  s.pushMessage({ id: uid(), role: "user", text: message });
  s.setSteps("THIRD EYE", [{ label: "Sending command to backend", status: "active" }]);
  try {
    const state = useApp.getState();
    const response = await fetch("/api/assistant", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        message,
        context: {
          view: state.view, activeLayers: [...state.layers], timeRange: state.time,
          selectedRecord: state.nisarGranules.find(v => v.id === state.selectedId) ?? state.liveEvents.find(v => v.id === state.selectedId) ?? null,
        },
      }),
    });
    const data = await response.json() as { message?: unknown; actions?: unknown; mode?: unknown; warning?: unknown; error?: unknown };
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `Assistant API returned HTTP ${response.status}.`);
    const actions = Array.isArray(data.actions) ? data.actions.map(actionFrom).filter((v): v is Action => v !== null).slice(0, 5) : [];
    for (const action of actions) if (action.type !== "navigate") execute(action);
    const buttons = actions.filter((a): a is Extract<Action, { type: "navigate" }> => a.type === "navigate")
      .map(a => ({ label: a.route === "/data" ? "Open NISAR data" : a.route === "/analyze" ? "Open analysis" : "Open section", run: `navigate:${a.route}` }));
    if (!buttons.length && actions.some(a => a.type === "search_nisar")) buttons.push({ label: "Open NISAR data", run: "navigate:/data" });
    const warning = typeof data.warning === "string" ? ` ${data.warning}` : "";
    const note = data.mode === "ai" ? "" : " (Safe command rules; add AI_GATEWAY_API_KEY in Vercel for model-backed reasoning.)";
    useApp.getState().setSteps(null, null);
    useApp.getState().pushMessage({ id: uid(), role: "system", text: `${typeof data.message === "string" ? data.message : "Command processed."}${warning}${note}`, actions: buttons });
  } catch (error) {
    useApp.getState().setSteps(null, null);
    useApp.getState().pushMessage({ id: uid(), role: "system", text: error instanceof Error ? `The assistant backend could not be reached: ${error.message}` : "The assistant backend could not be reached." });
  }
}
export function applyAssistantAction(raw: string): boolean {
  if (!raw.startsWith("action:")) return false;
  try { const action = actionFrom(JSON.parse(decodeURIComponent(raw.slice(7))) as unknown); return action ? execute(action) : false; }
  catch { return false; }
}
