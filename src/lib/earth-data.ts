import { EVENTS, LOCATIONS, OBSERVATIONS, PHENOMENA, type Confidence, type EarthEvent, type Observation, type Phenomenon } from "./mock-data";

export type Provenance = "sample" | "live";
export type EvidenceClass = "nisar" | "supporting" | "multi-source";
export type ObservationStage = "observed" | "detected" | "interpreted";
export type SeverityBand = "low" | "moderate" | "high";
export type LodBand = "global" | "regional" | "local" | "analysis";
export type EarthMode = "3d" | "2d";

export interface Coordinate { lat: number; lng: number }
export interface SampleGeometry {
  id: string;
  label: "SAMPLE GEOMETRY";
  kind: "footprint" | "perimeter" | "track";
  coordinates: Coordinate[];
}

export interface EarthEventRecord extends EarthEvent {
  provenance: Provenance;
  stage: ObservationStage;
  evidenceClass: EvidenceClass;
  validFrom: string;
  validTo: string;
  geometry: SampleGeometry;
}

export interface ObservationRecord extends Observation {
  provenance: Provenance;
  mission: "NISAR";
  band: "L-band";
  resolution: string;
  status: "Sample catalog";
  geometry: SampleGeometry;
}

const spanFor = (event: EarthEvent, index: number) => {
  const areaLike = ["flood", "fire", "forest", "glacier", "coastal", "urban"].includes(event.type);
  const dx = areaLike ? 0.55 + (index % 3) * 0.16 : 0.22 + (index % 2) * 0.08;
  const dy = areaLike ? 0.34 + (index % 2) * 0.14 : 0.16 + (index % 3) * 0.05;
  return { dx, dy };
};

function samplePolygon(event: EarthEvent, index: number): SampleGeometry {
  const { dx, dy } = spanFor(event, index);
  const skew = index % 2 ? 0.12 : -0.08;
  return {
    id: `GEO-${event.id}`,
    label: "SAMPLE GEOMETRY",
    kind: ["flood", "fire", "forest", "glacier", "coastal", "urban"].includes(event.type) ? "perimeter" : "footprint",
    coordinates: [
      { lng: event.lng - dx, lat: event.lat - dy * 0.45 },
      { lng: event.lng - dx * 0.35, lat: event.lat - dy },
      { lng: event.lng + dx * 0.78, lat: event.lat - dy * 0.55 },
      { lng: event.lng + dx, lat: event.lat + dy * 0.28 },
      { lng: event.lng + dx * 0.18, lat: event.lat + dy },
      { lng: event.lng - dx * 0.84 + skew, lat: event.lat + dy * 0.54 },
    ],
  };
}

const evidenceClass = (event: EarthEvent): EvidenceClass => {
  const hasNisar = event.evidence.some((item) => item.source.toLowerCase().includes("nisar"));
  const hasSupportingSource = event.evidence.some((item) => !item.source.toLowerCase().includes("nisar"));
  if (hasNisar && hasSupportingSource) return "multi-source";
  return hasNisar ? "nisar" : "supporting";
};

export const EARTH_EVENTS: EarthEventRecord[] = EVENTS.map((event, index) => ({
  ...event,
  provenance: "sample",
  stage: event.confidence === "High" ? "observed" : event.confidence === "Moderate" ? "detected" : "interpreted",
  evidenceClass: evidenceClass(event),
  validFrom: event.date,
  validTo: event.date,
  geometry: samplePolygon(event, index),
}));

export const EARTH_OBSERVATIONS: ObservationRecord[] = OBSERVATIONS.map((observation, index) => ({
  ...observation,
  provenance: "sample",
  mission: "NISAR",
  band: "L-band",
  resolution: index % 2 ? "20 m sample metadata" : "40 m sample metadata",
  status: "Sample catalog",
  geometry: EARTH_EVENTS[index]?.geometry ?? { id: `GEO-${observation.id}`, label: "SAMPLE GEOMETRY", kind: "footprint", coordinates: [] },
}));

export const DATASETS = [
  { id: "RSLC", group: "PRIMARY", name: "NISAR RSLC", availability: "LIVE CMR CATALOG", description: "Real range-Doppler single-look complex granule metadata and browse discovery. Full raster analysis is not run in this frontend." },
  { id: "RIFG", group: "PRIMARY", name: "NISAR RIFG", availability: "LIVE CMR CATALOG", description: "Real wrapped-interferogram granule metadata and browse discovery. Full raster analysis is not run in this frontend." },
  { id: "RUNW", group: "PRIMARY", name: "NISAR RUNW", availability: "LIVE CMR CATALOG", description: "Real unwrapped-interferogram granule metadata and browse discovery. Full raster analysis is not run in this frontend." },
  { id: "ROFF", group: "PRIMARY", name: "NISAR ROFF", availability: "LIVE CMR CATALOG", description: "Real range-Doppler pixel-offset granule metadata and browse discovery. Full raster analysis is not run in this frontend." },
  { id: "GSLC", group: "PRIMARY", name: "NISAR GSLC", availability: "LIVE CMR CATALOG", description: "Real geocoded single-look complex granule metadata and browse discovery. Full raster analysis is not run in this frontend." },
  { id: "GCOV", group: "PRIMARY", name: "NISAR GCOV", availability: "LIVE CMR CATALOG", description: "Real geocoded polarimetric covariance granule metadata and browse discovery. Full raster analysis is not run in this frontend." },
  { id: "GUNW", group: "PRIMARY", name: "NISAR GUNW", availability: "LIVE CMR CATALOG", description: "Real geocoded unwrapped-interferogram granule metadata and browse discovery. Full raster analysis is not run in this frontend." },
  { id: "GOFF", group: "PRIMARY", name: "NISAR GOFF", availability: "LIVE CMR CATALOG", description: "Real geocoded pixel-offset granule metadata and browse discovery. Full raster analysis is not run in this frontend." },
  { id: "SME2", group: "PRIMARY", name: "NISAR SME2", availability: "LIVE CMR CATALOG", description: "Real soil-moisture granule metadata and browse discovery. Full raster analysis is not run in this frontend." },
  { id: "FIRMS", group: "SUPPORTING", name: "FIRMS thermal anomalies", availability: "NOT CONNECTED", description: "Thermal hotspot evidence source." },
  { id: "LANDSAT", group: "SUPPORTING", name: "Landsat optical imagery", availability: "NOT CONNECTED", description: "Optical context and vegetation indices." },
  { id: "DEM", group: "SUPPORTING", name: "Elevation and slope", availability: "SAMPLE CONTEXT", description: "Terrain context for interpretation." },
  { id: "USGS-EQ", group: "SUPPORTING", name: "USGS Earthquake Catalog", availability: "LIVE + HISTORICAL CONTEXT", description: "Public USGS catalog for magnitude 5+ earthquakes across a two-year archive. Context only; not a NISAR product." },
  { id: "NASA-EONET", group: "SUPPORTING", name: "NASA EONET Event Archive", availability: "LIVE + HISTORICAL CONTEXT", description: "Public open and closed wildfires, floods, landslides and volcanic events across a two-year archive. Context only; not a NISAR product." },

export interface EarthDataProvider {
  provenance: Provenance;
  events(): readonly EarthEventRecord[];
  observations(): readonly ObservationRecord[];
  event(id: string): EarthEventRecord | undefined;
  observation(id: string): ObservationRecord | undefined;
  locations(): typeof LOCATIONS;
  phenomena(): typeof PHENOMENA;
}

export const sampleDataProvider: EarthDataProvider = {
  provenance: "sample",
  events: () => EARTH_EVENTS,
  observations: () => EARTH_OBSERVATIONS,
  event: (id) => EARTH_EVENTS.find((event) => event.id === id),
  observation: (id) => EARTH_OBSERVATIONS.find((observation) => observation.id === id),
  locations: () => LOCATIONS,
  phenomena: () => PHENOMENA,
};

export const severityBand = (severity: number): SeverityBand => severity >= 0.7 ? "high" : severity >= 0.45 ? "moderate" : "low";
export const confidenceRank: Record<Confidence, number> = { Low: 1, Moderate: 2, High: 3 };
export const lodForAltitude = (altitude: number): LodBand => altitude >= 1.55 ? "global" : altitude >= 0.2 ? "regional" : altitude >= 0.015 ? "local" : "analysis";

export function eventOpacity(event: EarthEventRecord) {
  if (event.confidence === "High") return 1;
  if (event.confidence === "Moderate") return 0.68;
  return 0.38;
}

export function isPhenomenon(value: string): value is Phenomenon {
  return PHENOMENA.some((item) => item.id === value);
}