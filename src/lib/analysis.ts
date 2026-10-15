import area from "@turf/area";
import bbox from "@turf/bbox";
import circle from "@turf/circle";
import type { Feature, Geometry, Polygon, Position } from "geojson";

export type DrawTool = "point" | "rectangle" | "polygon" | "circle";
export interface AOI { name: string; feature: Feature<Geometry>; areaKm2: number; bounds: number[]; center: { lat: number; lng: number } }
export interface AnalysisResult { id: string; aoi: AOI; datasets: string[]; start: string; end: string; kind: string; provenance: "sample" }

export const ANALYSIS_CATALOG = [
  "Change Detection", "Difference", "Ratio", "Anomaly", "Trend", "Temporal Comparison",
  "Deformation", "Soil Moisture", "Classification", "Surface Change", "Before / After",
  "Fire Analysis", "Flood Analysis", "Landslide Analysis", "Agriculture Analysis",
];

export function makeAOI(feature: Feature<Geometry>, name = "Selected area"): AOI {
  const bounds = bbox(feature);
  if (bounds.length !== 4 || !bounds.every(Number.isFinite)) {
    throw new Error("The selected geometry has no valid geographic bounds.");
  }
  const [west = 0, south = 0, east = 0, north = 0] = bounds;
  const areaKm2 = area(feature) / 1e6;
  if (!Number.isFinite(areaKm2) || areaKm2 < 0) throw new Error("The area could not be calculated from this geometry.");
  return {
    name,
    feature,
    areaKm2,
    bounds,
    center: { lng: (west + east) / 2, lat: (south + north) / 2 },
  };
}

export function rectangleAOI(a: Position, b: Position) {
  const [x = 0, y = 0] = a;
  const [u = 0, v = 0] = b;
  const west = Math.min(x, u);
  const south = Math.min(y, v);
  const east = Math.max(x, u);
  const north = Math.max(y, v);
  if (west === east || south === north) throw new Error("Choose two different corners to create an area.");
  return makeAOI({
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] },
  }, "Rectangle AOI");
}

export function circleAOI(center: Position, radiusKm: number) {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 20000) {
    throw new Error("Circle radius must be greater than 0 and no more than 20,000 km.");
  }
  return makeAOI(circle(center, radiusKm, { steps: 64, units: "kilometers" }), "Circle AOI");
}

export function polygonAOI(points: Position[]) {
  const first = points[0];
  if (!first || points.length < 3) throw new Error("At least three vertices are required.");
  return makeAOI({
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [[...points, first]] },
  } as Feature<Polygon>, "Polygon AOI");
}

/**
 * Validate uploaded GeoJSON before passing it to Turf or a map renderer.
 * Multi-feature collections are kept together as GeometryCollections instead of
 * silently discarding every feature after the first. Uploaded data is not trusted.
 */
export function validateGeometry(value: unknown): Feature<Geometry> {
  const state = { vertices: 0 };
  const geometry = normalizeGeometry(value, state);
  if (state.vertices === 0) throw new Error("The geometry contains no coordinates.");
  if (state.vertices > 10000) throw new Error("Area files are limited to 10,000 vertices.");
  return { type: "Feature", properties: {}, geometry };
}

function normalizeGeometry(value: unknown, state: { vertices: number }): Geometry {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("No valid geographic geometry was found.");
  }

  const record = value as Record<string, unknown>;
  if (record.type === "Feature") {
    if (!record.geometry) throw new Error("A GeoJSON feature is missing its geometry.");
    return normalizeGeometry(record.geometry, state);
  }

  if (record.type === "FeatureCollection") {
    const features = record.features;
    if (!Array.isArray(features) || features.length === 0) throw new Error("The file contains no features.");
    const geometries = features.map(feature => normalizeGeometry(feature, state));
    return geometries.length === 1
      ? geometries[0]!
      : { type: "GeometryCollection", geometries };
  }

  if (record.type === "GeometryCollection") {
    const geometries = record.geometries;
    if (!Array.isArray(geometries) || geometries.length === 0) {
      throw new Error("The geometry collection contains no geometries.");
    }
    return { type: "GeometryCollection", geometries: geometries.map(geometry => normalizeGeometry(geometry, state)) };
  }

  if (!["Point", "Polygon", "MultiPolygon", "LineString"].includes(String(record.type))) {
    throw new Error("Supported geometry: point, polygon, multipolygon, line, or a collection of these.");
  }

  const coordinates = record.coordinates;
  function check(item: unknown): void {
    if (!Array.isArray(item) || item.length === 0) throw new Error("Geometry coordinates must be non-empty arrays.");
    if (typeof item[0] === "number") {
      const [lng, lat] = item;
      if (item.length < 2 || typeof lng !== "number" || typeof lat !== "number"
        || !Number.isFinite(lng) || !Number.isFinite(lat)
        || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
        throw new Error("Coordinates must contain valid longitude and latitude values.");
      }
      state.vertices += 1;
      if (state.vertices > 10000) throw new Error("Area files are limited to 10,000 vertices.");
      return;
    }
    item.forEach(check);
  }

  check(coordinates);
  return record as unknown as Geometry;
}
