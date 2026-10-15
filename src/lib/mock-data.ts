// ILLUSTRATIVE DEMO DATA — not real NASA/NISAR measurements.
// Replace with backend responses (FastAPI / PostGIS) when available.

export type Phenomenon =
  | "fire" | "flood" | "forest" | "agriculture" | "soil" | "landslide"
  | "volcano" | "earthquake" | "glacier" | "subsidence" | "coastal" | "urban";

export const PHENOMENA: { id: Phenomenon; label: string; color: string }[] = [
  { id: "fire", label: "Fire", color: "#ff6a2b" },
  { id: "flood", label: "Flood", color: "#2fb8ff" },
  { id: "forest", label: "Forest", color: "#4fbf6a" },
  { id: "agriculture", label: "Agriculture", color: "#a6d65a" },
  { id: "soil", label: "Soil Moisture", color: "#3fc7a8" },
  { id: "landslide", label: "Landslide", color: "#ffa53a" },
  { id: "volcano", label: "Volcano", color: "#ff4d3d" },
  { id: "earthquake", label: "Earthquake", color: "#a98bff" },
  { id: "glacier", label: "Glacier", color: "#cdefff" },
  { id: "subsidence", label: "Subsidence", color: "#e07a5f" },
  { id: "coastal", label: "Coastal Change", color: "#5ad1e0" },
  { id: "urban", label: "Urban Change", color: "#ff8a4a" },
];

export const phenomenonColor = (p: Phenomenon) => PHENOMENA.find((x) => x.id === p)?.color ?? "var(--primary)";
export const phenomenonLabel = (p: Phenomenon) => PHENOMENA.find((x) => x.id === p)?.label ?? "Surface Change";

export type Confidence = "Low" | "Moderate" | "High";
export type Strength = "Strong" | "Moderate" | "Weak";

export interface EarthEvent {
  id: string;
  type: Phenomenon;
  title: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
  date: string; // ISO
  metric: string;
  metricLabel: string;
  severity: number; // 0..1
  confidence: Confidence;
  evidence: { source: string; strength: Strength }[];
  interpretation: string;
  observationId: string;
}

export const EVENTS: EarthEvent[] = [
  { id: "EV-0412", type: "flood", title: "Flood candidate", region: "Maharashtra", country: "India", lat: 19.07, lng: 72.88, date: "2026-09-18", metric: "126 km²", metricLabel: "Potential affected area", severity: 0.72, confidence: "Moderate", evidence: [{ source: "NISAR", strength: "Strong" }, { source: "Rainfall", strength: "Strong" }, { source: "Terrain", strength: "Moderate" }], interpretation: "Radar backscatter decrease is consistent with recent inundation of low-lying terrain.", observationId: "NISAR-GCOV-ORB-1842" },
  { id: "EV-0398", type: "fire", title: "Active fire cluster", region: "Odisha", country: "India", lat: 20.94, lng: 84.8, date: "2026-03-22", metric: "42 km²", metricLabel: "Burn scar candidate", severity: 0.64, confidence: "High", evidence: [{ source: "Thermal anomaly", strength: "Strong" }, { source: "NISAR coherence", strength: "Moderate" }], interpretation: "Coherence loss coincides with thermal hotspots, consistent with vegetation burning.", observationId: "NISAR-GCOV-ORB-1203" },
  { id: "EV-0377", type: "landslide", title: "Landslide candidate", region: "Uttarakhand, Himalaya", country: "India", lat: 30.73, lng: 79.07, date: "2026-07-30", metric: "3.4 cm/yr", metricLabel: "Line-of-sight motion", severity: 0.58, confidence: "Moderate", evidence: [{ source: "NISAR InSAR", strength: "Strong" }, { source: "Slope", strength: "Strong" }, { source: "Rainfall", strength: "Moderate" }], interpretation: "Persistent downslope deformation on a steep slope; supporting evidence suggests elevated hazard.", observationId: "NISAR-GUNW-ORB-1611" },
  { id: "EV-0355", type: "subsidence", title: "Ground subsidence", region: "Jakarta", country: "Indonesia", lat: -6.2, lng: 106.85, date: "2026-06-11", metric: "−8.1 cm/yr", metricLabel: "Vertical deformation", severity: 0.81, confidence: "High", evidence: [{ source: "NISAR InSAR", strength: "Strong" }, { source: "GNSS", strength: "Moderate" }], interpretation: "Long-term subsidence consistent with groundwater extraction patterns.", observationId: "NISAR-GUNW-ORB-1488" },
  { id: "EV-0341", type: "volcano", title: "Volcanic inflation", region: "Etna, Sicily", country: "Italy", lat: 37.75, lng: 14.99, date: "2026-05-04", metric: "+2.2 cm", metricLabel: "Uplift (30 days)", severity: 0.55, confidence: "Moderate", evidence: [{ source: "NISAR InSAR", strength: "Strong" }, { source: "Seismicity", strength: "Weak" }], interpretation: "Radial uplift pattern is consistent with shallow magma accumulation.", observationId: "NISAR-GUNW-ORB-1320" },
  { id: "EV-0330", type: "earthquake", title: "Co-seismic deformation", region: "Eastern Anatolia", country: "Türkiye", lat: 37.2, lng: 37.0, date: "2026-02-14", metric: "M 6.1", metricLabel: "Reported magnitude", severity: 0.77, confidence: "High", evidence: [{ source: "NISAR interferogram", strength: "Strong" }, { source: "Seismic catalog", strength: "Strong" }], interpretation: "Interferometric fringes indicate surface displacement along a strike-slip fault.", observationId: "NISAR-RIFG-ORB-1101" },
  { id: "EV-0322", type: "glacier", title: "Glacier retreat", region: "Jakobshavn", country: "Greenland", lat: 69.17, lng: -49.8, date: "2026-08-09", metric: "−1.9 km", metricLabel: "Terminus change (yr)", severity: 0.6, confidence: "High", evidence: [{ source: "NISAR offsets", strength: "Strong" }, { source: "Optical", strength: "Moderate" }], interpretation: "Pixel-offset tracking shows accelerated flow and terminus retreat.", observationId: "NISAR-GOFF-ORB-1555" },
  { id: "EV-0310", type: "forest", title: "Forest loss candidate", region: "Rondônia", country: "Brazil", lat: -10.9, lng: -62.8, date: "2026-04-19", metric: "18 km²", metricLabel: "Canopy loss candidate", severity: 0.5, confidence: "Moderate", evidence: [{ source: "NISAR backscatter", strength: "Strong" }, { source: "Optical NDVI", strength: "Moderate" }], interpretation: "HV backscatter decrease is consistent with canopy removal.", observationId: "NISAR-GCOV-ORB-1277" },
  { id: "EV-0301", type: "agriculture", title: "Crop stress anomaly", region: "Punjab", country: "India", lat: 30.9, lng: 75.85, date: "2026-05-28", metric: "−14%", metricLabel: "Vegetation index anomaly", severity: 0.42, confidence: "Low", evidence: [{ source: "NISAR GCOV", strength: "Moderate" }, { source: "Soil moisture", strength: "Moderate" }], interpretation: "Lower-than-seasonal backscatter may indicate crop water stress.", observationId: "NISAR-GCOV-ORB-1350" },
  { id: "EV-0295", type: "soil", title: "Soil moisture anomaly", region: "Rajasthan", country: "India", lat: 26.9, lng: 73.0, date: "2026-06-30", metric: "0.08 m³/m³", metricLabel: "Below seasonal mean", severity: 0.48, confidence: "Moderate", evidence: [{ source: "NISAR SME2", strength: "Strong" }, { source: "Rainfall", strength: "Moderate" }], interpretation: "Soil moisture deficit consistent with delayed monsoon onset.", observationId: "NISAR-SME2-ORB-1402" },
  { id: "EV-0288", type: "coastal", title: "Shoreline change", region: "Sundarbans", country: "Bangladesh", lat: 21.95, lng: 89.18, date: "2026-07-12", metric: "−38 m", metricLabel: "Shoreline shift", severity: 0.52, confidence: "Moderate", evidence: [{ source: "NISAR amplitude", strength: "Strong" }], interpretation: "Amplitude edges suggest erosion along the delta front.", observationId: "NISAR-GCOV-ORB-1520" },
  { id: "EV-0276", type: "fire", title: "Wildfire perimeter", region: "British Columbia", country: "Canada", lat: 50.7, lng: -120.3, date: "2026-08-02", metric: "310 km²", metricLabel: "Burned area candidate", severity: 0.86, confidence: "High", evidence: [{ source: "Thermal anomaly", strength: "Strong" }, { source: "NISAR coherence", strength: "Strong" }], interpretation: "Large coherence-loss region aligned with reported fire perimeter.", observationId: "NISAR-GCOV-ORB-1540" },
  { id: "EV-0264", type: "flood", title: "Flood candidate", region: "Sindh", country: "Pakistan", lat: 25.4, lng: 68.4, date: "2026-08-24", metric: "412 km²", metricLabel: "Potential affected area", severity: 0.83, confidence: "Moderate", evidence: [{ source: "NISAR", strength: "Strong" }, { source: "Rainfall", strength: "Strong" }], interpretation: "Widespread low backscatter consistent with standing water.", observationId: "NISAR-GCOV-ORB-1590" },
  { id: "EV-0251", type: "urban", title: "Urban expansion", region: "Bengaluru", country: "India", lat: 12.97, lng: 77.59, date: "2026-01-20", metric: "+6.2 km²", metricLabel: "New built-up candidate", severity: 0.35, confidence: "Moderate", evidence: [{ source: "NISAR amplitude", strength: "Strong" }], interpretation: "Persistent bright scatterers suggest new construction at the urban fringe.", observationId: "NISAR-GCOV-ORB-1012" },
];

export interface Observation {
  id: string;
  product: string;
  orbit: string;
  date: string;
  mode: string;
  polarization: string;
  region: string;
  quality: "Nominal" | "Degraded" | "Processing";
  lat: number;
  lng: number;
}

const products = ["GCOV", "GUNW", "RSLC", "GSLC", "RIFG", "GOFF", "SME2"];
export const OBSERVATIONS: Observation[] = EVENTS.map((e, i) => ({
  id: e.observationId,
  product: e.observationId.split("-")[1] ?? products[i % products.length] ?? "GCOV",
  orbit: e.observationId.split("-").slice(2).join("-"),
  date: e.date,
  mode: i % 2 ? "L-band 20 MHz" : "L-band 40 MHz",
  polarization: i % 3 === 0 ? "HH/HV" : i % 3 === 1 ? "VV/VH" : "Quad",
  region: `${e.region}, ${e.country}`,
  quality: i === 3 ? "Processing" : i === 8 ? "Degraded" : "Nominal",
  lat: e.lat,
  lng: e.lng,
}));

export const LOCATIONS = [
  { name: "Mumbai", kind: "City", lat: 19.07, lng: 72.88 },
  { name: "Maharashtra", kind: "Region", lat: 19.6, lng: 75.5 },
  { name: "India", kind: "Country", lat: 22.5, lng: 79.0 },
  { name: "Himalayas", kind: "Region", lat: 29.5, lng: 82.0 },
  { name: "Jakarta", kind: "City", lat: -6.2, lng: 106.85 },
  { name: "Greenland", kind: "Region", lat: 72, lng: -40 },
  { name: "Amazon Basin", kind: "Region", lat: -5, lng: -62 },
  { name: "Sicily", kind: "Region", lat: 37.6, lng: 14.2 },
  { name: "British Columbia", kind: "Region", lat: 53.7, lng: -127.6 },
];

export const formatCoord = (lat: number, lng: number) =>
  `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}  ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`;

export const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
