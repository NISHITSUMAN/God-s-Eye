import type { Phenomenon } from "./mock-data";

export type LiveLayerId = "live-usgs" | "live-eonet";
export type LiveSource = "USGS" | "NASA EONET";

/** Real public feed records, kept distinct from the illustrative NISAR sample schema. */
export interface LiveEarthEvent {
  id: string;
  sourceId: string;
  source: LiveSource;
  sourceLabel: string;
  sourceUrl: string;
  layerId: LiveLayerId;
  type: Phenomenon;
  title: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
  date: string;
  metric: string;
  metricLabel: string;
  summary: string;
}

interface USGSFeature {
  id?: string;
  type?: string;
  geometry?: { type?: string; coordinates?: unknown };
  properties?: {
    mag?: number | null;
    place?: string | null;
    time?: number | null;
    url?: string | null;
    detail?: string | null;
    magType?: string | null;
    depth?: number | null;
    status?: string | null;
    title?: string | null;
  } | null;
}

interface EONETGeometry {
  date?: string;
  type?: string;
  coordinates?: unknown;
}

interface EONETEvent {
  id?: string;
  title?: string;
  description?: string | null;
  link?: string;
  categories?: Array<{ id?: string; title?: string }>;
  sources?: Array<{ id?: string; url?: string }>;
  geometry?: EONETGeometry[];
}

async function fetchJSON<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/geo+json, application/json" },
    });
    if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}`);
    return await response.json() as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The data source timed out after 12 seconds.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

const validCoordinate = (lng: unknown, lat: unknown): boolean =>
  typeof lng === "number" && typeof lat === "number" &&
  Number.isFinite(lng) && Number.isFinite(lat) &&
  Math.abs(lng) <= 180 && Math.abs(lat) <= 90;

function safeSourceUrl(value: string | null | undefined, fallback: string, kind: "USGS" | "NASA EONET") {
  try {
    const url = new URL(value || fallback);
    const trustedHost = kind === "USGS"
      ? url.hostname === "usgs.gov" || url.hostname.endsWith(".usgs.gov")
      : url.hostname === "nasa.gov" || url.hostname.endsWith(".nasa.gov");
    return url.protocol === "https:" && trustedHost ? url.href : fallback;
  } catch {
    return fallback;
  }
}

/** Fetch USGS's public GeoJSON feed of earthquakes reported over the last day. */
export async function fetchUSGSEarthquakes(): Promise<LiveEarthEvent[]> {
  const data = await fetchJSON<{ features?: USGSFeature[] }>(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
  );
  if (!Array.isArray(data.features)) throw new Error("USGS returned an unexpected GeoJSON response.");

  return data.features.flatMap((feature): LiveEarthEvent[] => {
    const p = feature.properties;
    const coordinates = feature.geometry?.coordinates;
    if (!p || !Array.isArray(coordinates) || coordinates.length < 2) return [];
    const [lng, lat, depth] = coordinates;
    if (typeof lng !== "number" || typeof lat !== "number" || !validCoordinate(lng, lat)) return [];
    const time = typeof p.time === "number" ? new Date(p.time) : new Date(NaN);
    if (!Number.isFinite(time.getTime())) return [];
    const magnitude = typeof p.mag === "number" && Number.isFinite(p.mag) ? p.mag : null;
    const title = p.title || p.place || "Reported earthquake";
    const sourceId = feature.id || `usgs-${time.getTime()}-${lng}-${lat}`;
    const details = [
      magnitude === null ? "Magnitude not reported" : `Magnitude ${magnitude.toFixed(1)}${p.magType ? ` (${p.magType})` : ""}`,
      typeof depth === "number" && Number.isFinite(depth) ? `Depth ${depth.toFixed(1)} km` : null,
      p.status ? `Catalog status: ${p.status}` : null,
    ].filter(Boolean).join(" · ");
    return [{
      id: `live:usgs:${sourceId}`,
      sourceId,
      source: "USGS",
      sourceLabel: "USGS Earthquake Feed",
      sourceUrl: safeSourceUrl(p.url || p.detail, "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php", "USGS"),
      layerId: "live-usgs",
      type: "earthquake",
      title,
      region: p.place || title,
      country: "",
      lat,
      lng,
      date: time.toISOString(),
      metric: magnitude === null ? "—" : `M ${magnitude.toFixed(1)}`,
      metricLabel: "reported earthquake magnitude",
      summary: details,
    }];
  });
}

function categoryPhenomenon(categories: EONETEvent["categories"]): Phenomenon | null {
  const ids = (categories ?? []).map(category => `${category.id ?? ""} ${category.title ?? ""}`.toLowerCase()).join(" ");
  if (/wildfire|wildfires|fire/.test(ids)) return "fire";
  if (/flood/.test(ids)) return "flood";
  if (/landslide/.test(ids)) return "landslide";
  if (/volcano/.test(ids)) return "volcano";
  return null;
}

function meanCoordinate(value: unknown): [number, number] | null {
  const positions: Array<[number, number]> = [];
  const visit = (item: unknown) => {
    if (!Array.isArray(item) || positions.length >= 2000) return;
    const lng = item[0];
    const lat = item[1];
    if (typeof lng === "number" && typeof lat === "number" && validCoordinate(lng, lat)) {
      positions.push([lng, lat]);
      return;
    }
    item.forEach(visit);
  };
  visit(value);
  if (!positions.length) return null;
  const sum = positions.reduce((total, point) => [total[0] + point[0], total[1] + point[1]], [0, 0] as [number, number]);
  return [sum[0] / positions.length, sum[1] / positions.length];
}

/** Fetch open NASA EONET natural events; unmapped categories are intentionally omitted. */
export async function fetchNASAEONETEvents(): Promise<LiveEarthEvent[]> {
  const data = await fetchJSON<{ events?: EONETEvent[] }>(
    "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100",
  );
  if (!Array.isArray(data.events)) throw new Error("NASA EONET returned an unexpected response.");

  return data.events.flatMap((event): LiveEarthEvent[] => {
    const type = categoryPhenomenon(event.categories);
    if (!type || !Array.isArray(event.geometry) || !event.geometry.length) return [];
    const latest = [...event.geometry].sort((a, b) =>
      Date.parse(a.date || "") - Date.parse(b.date || ""),
    ).at(-1);
    if (!latest) return [];
    const coordinate = meanCoordinate(latest.coordinates);
    if (!coordinate) return [];
    const [lng, lat] = coordinate;
    const date = latest.date && Number.isFinite(Date.parse(latest.date))
      ? new Date(latest.date).toISOString()
      : new Date().toISOString();
    const category = event.categories?.find(item =>
      item.id && categoryPhenomenon([item]) === type,
    )?.title ?? type;
    const sourceId = event.id || `${type}-${date}-${lng}-${lat}`;
    return [{
      id: `live:eonet:${sourceId}`,
      sourceId,
      source: "NASA EONET",
      sourceLabel: "NASA Earth Observatory Natural Event Tracker",
      sourceUrl: safeSourceUrl(event.link, "https://eonet.gsfc.nasa.gov/", "NASA EONET"),
      layerId: "live-eonet",
      type,
      title: event.title || category,
      region: category,
      country: "",
      lat,
      lng,
      date,
      metric: "OPEN",
      metricLabel: category,
      summary: event.description || `Open EONET event categorized as ${category}.`,
    }];
  });
}

export async function fetchLiveEarthData() {
  const [usgs, eonet] = await Promise.allSettled([fetchUSGSEarthquakes(), fetchNASAEONETEvents()]);
  const events = [
    ...(usgs.status === "fulfilled" ? usgs.value : []),
    ...(eonet.status === "fulfilled" ? eonet.value : []),
  ];
  const errors = [
    ...(usgs.status === "rejected" ? [`USGS: ${usgs.reason instanceof Error ? usgs.reason.message : "request failed"}`] : []),
    ...(eonet.status === "rejected" ? [`NASA EONET: ${eonet.reason instanceof Error ? eonet.reason.message : "request failed"}`] : []),
  ];
  if (events.length === 0 && errors.length > 0) throw new Error(errors.join(" "));
  return { events, errors };
}
