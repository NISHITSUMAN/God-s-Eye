import { createFileRoute } from "@tanstack/react-router";

type Action =
  | { type: "fly_to"; lat: number; lng: number; altitude?: number }
  | { type: "set_layer"; layer: string; enabled: boolean }
  | { type: "search_nisar"; region: "India" | "Kashmir" | "Ladakh" | "Global"; productCodes?: string[] }
  | { type: "navigate"; route: "/" | "/data" | "/analyze" | "/observations" | "/events" | "/discover" }
  | { type: "refresh_live" };
type Context = {
  view?: { lat?: number; lng?: number; altitude?: number };
  activeLayers?: string[];
  selectedRecord?: { title?: string; source?: string; date?: string } | null;
  timeRange?: { start?: string; end?: string; current?: string };
};
type Result = { message: string; actions: Action[]; mode: "ai" | "rules"; warning?: string };

const PRODUCTS = ["GCOV", "GSLC", "GUNW", "GOFF", "RSLC", "RIFG", "ROFF", "RUNW", "SME2"];
const LAYERS = ["nisar-coverage", ...PRODUCTS.map(v => `prod-${v}`), "live-usgs", "live-eonet"];
const ROUTES = ["/", "/data", "/analyze", "/observations", "/events", "/discover"] as const;
const MAX_BYTES = 12_000;
const MAX_MESSAGE = 1_200;
const buckets = new Map<string, { start: number; count: number }>();

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
function underRateLimit(request: Request) {
  const ip = request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "unknown";
  const now = Date.now();
  for (const [key, value] of buckets) if (now - value.start > 60_000) buckets.delete(key);
  const value = buckets.get(ip);
  if (!value || now - value.start > 60_000) { buckets.set(ip, { start: now, count: 1 }); return true; }
  if (value.count >= 20) return false;
  value.count++;
  return true;
}
function validateAction(value: unknown): Action | null {
  if (!record(value) || typeof value.type !== "string") return null;
  if (value.type === "fly_to") {
    const lat = Number(value.lat), lng = Number(value.lng), altitude = value.altitude === undefined ? 0.4 : Number(value.altitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(altitude) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && altitude >= 0.002 && altitude <= 5
      ? { type: "fly_to", lat, lng, altitude } : null;
  }
  if (value.type === "set_layer" && typeof value.layer === "string" && LAYERS.includes(value.layer) && typeof value.enabled === "boolean") return { type: "set_layer", layer: value.layer, enabled: value.enabled };
  if (value.type === "search_nisar" && typeof value.region === "string" && ["India", "Kashmir", "Ladakh", "Global"].includes(value.region)) {
    const codes = Array.isArray(value.productCodes) ? [...new Set(value.productCodes.filter((v): v is string => typeof v === "string").map(v => v.toUpperCase()))].filter(v => PRODUCTS.includes(v)).slice(0, 5) : [];
    return { type: "search_nisar", region: value.region as "India" | "Kashmir" | "Ladakh" | "Global", ...(codes.length ? { productCodes: codes } : {}) };
  }
  if (value.type === "navigate" && typeof value.route === "string" && ROUTES.includes(value.route as (typeof ROUTES)[number])) return { type: "navigate", route: value.route as (typeof ROUTES)[number] };
  if (value.type === "refresh_live") return { type: "refresh_live" };
  return null;
}
function fallback(message: string): Result {
  const q = message.toLowerCase();
  const actions: Action[] = [];
  const product = PRODUCTS.find(code => new RegExp(`\\b${code.toLowerCase()}\\b`).test(q));
  const region: "India" | "Kashmir" | "Ladakh" = /ladakh|leh/.test(q) ? "Ladakh" : /kashmir|jammu/.test(q) ? "Kashmir" : "India";
  if (/nisar|coverage|acquisition|granule|radar|satellite data|product/.test(q)) actions.push({ type: "search_nisar", region, ...(product ? { productCodes: [product] } : {}) });
  if (/earthquake|earthquakes|usgs/.test(q)) actions.push({ type: "set_layer", layer: "live-usgs", enabled: true }, { type: "refresh_live" });
  if (/eonet|wildfire|wildfires|flood|landslide|volcano|natural events/.test(q)) actions.push({ type: "set_layer", layer: "live-eonet", enabled: true }, { type: "refresh_live" });
  if (/live data|live feeds|refresh feeds/.test(q)) actions.push({ type: "refresh_live" });
  if (/ladakh|leh/.test(q)) actions.push({ type: "fly_to", lat: 34.4, lng: 78.1, altitude: 0.09 });
  else if (/kashmir|jammu/.test(q)) actions.push({ type: "fly_to", lat: 34.4, lng: 76.2, altitude: 0.18 });
  else if (/mumbai/.test(q)) actions.push({ type: "fly_to", lat: 19.076, lng: 72.8777, altitude: 0.02 });
  else if (/delhi/.test(q)) actions.push({ type: "fly_to", lat: 28.6139, lng: 77.209, altitude: 0.02 });
  if (/open|go to|show me/.test(q)) {
    const route = /analys/.test(q) ? "/analyze" : /observ/.test(q) ? "/observations" : /data|catalog|nisar/.test(q) ? "/data" : /discover/.test(q) ? "/discover" : null;
    if (route) actions.push({ type: "navigate", route });
  }
  const text = actions.some(a => a.type === "search_nisar")
    ? `Prepared a real NASA CMR search for ${region} NISAR acquisitions${product ? ` in ${product}` : ""}. Catalog coverage is acquisition metadata, not a processed hazard detection.`
    : actions.some(a => a.type === "refresh_live")
      ? "Enabled the requested public data layer and requested a refresh."
      : actions.some(a => a.type === "fly_to")
        ? "Moving the globe. Satellite imagery remains a geographic basemap, separate from science data."
        : "The assistant backend is online. Add AI_GATEWAY_API_KEY in Vercel for model-backed natural-language planning.";
  return { message: text, actions: actions.slice(0, 5), mode: "rules" };
}
function parseActions(message: Record<string, unknown>): Action[] {
  if (!Array.isArray(message.tool_calls)) return [];
  const result: Action[] = [];
  for (const item of message.tool_calls) {
    if (!record(item) || !record(item.function) || item.function.name !== "apply_action" || typeof item.function.arguments !== "string") continue;
    try { const action = validateAction(JSON.parse(item.function.arguments) as unknown); if (action) result.push(action); } catch { /* invalid tool arguments are ignored */ }
  }
  return result.slice(0, 5);
}
async function askModel(message: string, context: Context): Promise<Result | null> {
  const gateway = process.env.AI_GATEWAY_API_KEY;
  const key = gateway || process.env.AI_API_KEY;
  if (!key) return null;
  const baseUrl = process.env.AI_BASE_URL?.replace(/\/+$/, "") || (gateway ? "https://ai-gateway.vercel.sh/v1" : "https://api.openai.com/v1");
  const model = process.env.AI_MODEL || (gateway ? "openai/gpt-4.1-mini" : "gpt-4.1-mini");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);
  const tools = [{ type: "function", function: {
    name: "apply_action",
    description: "Propose a viewer action from the safe allowlist. Never run code or destructive operations.",
    parameters: {
      type: "object", additionalProperties: false, required: ["type"],
      properties: {
        type: { type: "string", enum: ["fly_to", "set_layer", "search_nisar", "navigate", "refresh_live"] },
        lat: { type: "number" }, lng: { type: "number" }, altitude: { type: "number" },
        layer: { type: "string", enum: LAYERS }, enabled: { type: "boolean" },
        region: { type: "string", enum: ["India", "Kashmir", "Ladakh", "Global"] },
        productCodes: { type: "array", items: { type: "string", enum: PRODUCTS }, maxItems: 5 },
        route: { type: "string", enum: ROUTES },
      },
    },
  }}];
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, temperature: 0.15, max_tokens: 600,
        messages: [
          { role: "system", content: "You are Third Eye, an Earth-observation assistant. Propose viewer actions only when asked. Distinguish NASA CMR acquisition coverage from processed science measurements. The satellite basemap is context, not NISAR radar. Sample layers are not confirmed detections. Be concise and honest. Viewer context: " + JSON.stringify(context).slice(0, 3000) },
          { role: "user", content: message },
        ],
        tools, tool_choice: "auto",
      }),
      signal: controller.signal,
    });
    if (!response.ok) { console.warn("AI provider returned HTTP", response.status); return null; }
    const payload: unknown = await response.json();
    if (!record(payload) || !Array.isArray(payload.choices) || !record(payload.choices[0]) || !record(payload.choices[0].message)) return null;
    const choice = payload.choices[0].message;
    return { message: typeof choice.content === "string" && choice.content.trim() ? choice.content.trim() : "I prepared the viewer action.", actions: parseActions(choice), mode: "ai" };
  } catch (error) { console.warn("AI provider request failed.", error); return null; }
  finally { clearTimeout(timer); }
}

export const Route = createFileRoute("/api/assistant")({
  server: { handlers: {
    GET: async () => json({ ok: true, endpoint: "/api/assistant", methods: ["POST"], providerConfigured: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.AI_API_KEY) }),
    POST: async ({ request }) => {
      if (!underRateLimit(request)) return json({ error: "Too many commands. Please wait a minute and retry." }, 429);
      if (Number(request.headers.get("content-length") || 0) > MAX_BYTES) return json({ error: "Request is too large." }, 413);
      let raw: string;
      try { raw = await request.text(); } catch { return json({ error: "Send a valid JSON body." }, 400); }
      if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) return json({ error: "Request is too large." }, 413);
      let body: unknown;
      try { body = JSON.parse(raw) as unknown; } catch { return json({ error: "Send a valid JSON body." }, 400); }
      if (!record(body) || typeof body.message !== "string") return json({ error: "The message field is required." }, 400);
      const message = body.message.trim();
      if (!message || message.length > MAX_MESSAGE) return json({ error: `Message must contain 1-${MAX_MESSAGE} characters.` }, 400);
      const context = record(body.context) ? body.context as Context : {};
      const result = await askModel(message, context);
      if (result) return json(result);
      return json({ ...fallback(message), ...(process.env.AI_GATEWAY_API_KEY || process.env.AI_API_KEY ? { warning: "AI provider unavailable; safe command rules were used." } : {}) });
    },
  }},
});
