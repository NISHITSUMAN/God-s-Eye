import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useApp, visibleEvents } from "@/lib/store";
import { eventOpacity } from "@/lib/earth-data";
import { phenomenonColor } from "@/lib/mock-data";

export default function EarthMap() {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const layers = useApp(s => s.layers); const filter = useApp(s => s.filter); const time = useApp(s => s.time); const lod = useApp(s => s.lod); const selected = useApp(s => s.selectedId); const nonce = useApp(s => s.viewNonce); const opacity = useApp(s => s.opacity); const liveEvents = useApp(s => s.liveEvents);
  const update = () => {
    const map = mapRef.current; if (!map?.isStyleLoaded()) return;
    const state = useApp.getState();
    const events = visibleEvents(state);
    const pointData = { type: "FeatureCollection" as const, features: events.map(event => ({ type: "Feature" as const, properties: { id: event.id, color: phenomenonColor(event.type), alpha: eventOpacity(event) * ((state.opacity[event.type] ?? 100) / 100), selected: event.id === state.selectedId }, geometry: { type: "Point" as const, coordinates: [event.lng, event.lat] } })) };
    const polygonData = { type: "FeatureCollection" as const, features: state.layers.has("nisar-footprints") ? events.map(event => ({ type: "Feature" as const, properties: { id: event.id, selected: event.id === state.selectedId }, geometry: { type: "Polygon" as const, coordinates: [[...event.geometry.coordinates, ...(event.geometry.coordinates[0] ? [event.geometry.coordinates[0]] : [])].map(p => [p.lng, p.lat])] } })) : [] };
    (map.getSource("events") as maplibregl.GeoJSONSource | undefined)?.setData(pointData);
    (map.getSource("footprints") as maplibregl.GeoJSONSource | undefined)?.setData(polygonData);
    const liveFeatures = state.liveEvents.filter((event) => {
      if (!state.layers.has(event.layerId)) return false;
      if (state.filter.types && !state.filter.types.includes(event.type)) return false;
      if (state.filter.region && !`${event.region} ${event.country}`.toLowerCase().includes(state.filter.region.toLowerCase())) return false;
      const day = event.date.slice(0, 10);
      return day >= state.time.start && day <= state.time.end;
    }).map(event => ({
      type: "Feature" as const,
      properties: {
        id: event.id,
        color: phenomenonColor(event.type),
        title: event.title,
        region: event.region,
        source: event.sourceLabel,
        sourceUrl: event.sourceUrl,
        date: event.date,
        metric: event.metric,
        metricLabel: event.metricLabel,
        summary: event.summary,
      },
      geometry: { type: "Point" as const, coordinates: [event.lng, event.lat] },
    }));
    (map.getSource("live-events") as maplibregl.GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: liveFeatures });
  };
  useEffect(() => {
    if (!el.current) return;
    const view = useApp.getState().view;
    const map = new maplibregl.Map({ container: el.current, center: [view.lng, view.lat], zoom: Math.max(1, 4 - Math.log2(view.altitude * 4)), attributionControl: false, style: { version: 8, sources: { imagery: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "Esri, Maxar, Earthstar Geographics" } }, layers: [{ id: "imagery", type: "raster", source: "imagery" }] } });
    mapRef.current = map;
    map.on("load", () => {
      const selection = getComputedStyle(document.documentElement).getPropertyValue("--earth-selection").trim();
      map.addSource("events", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("footprints", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("live-events", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "footprint-fill", type: "fill", source: "footprints", paint: { "fill-color": selection, "fill-opacity": 0.07 } });
      map.addLayer({ id: "footprint-outline", type: "line", source: "footprints", paint: { "line-color": selection, "line-width": ["case", ["get", "selected"], 2, 1], "line-opacity": 0.65 } });
      map.addLayer({ id: "event-points", type: "circle", source: "events", paint: { "circle-color": ["get", "color"], "circle-opacity": ["get", "alpha"], "circle-radius": ["case", ["get", "selected"], 7, 4], "circle-stroke-color": selection, "circle-stroke-width": ["case", ["get", "selected"], 2, 0] } });
      map.addLayer({ id: "live-event-points", type: "circle", source: "live-events", paint: { "circle-color": ["get", "color"], "circle-opacity": 0.92, "circle-radius": 6, "circle-stroke-color": "#F7FAFC", "circle-stroke-width": 1.5 } });
      update();
      map.on("click", "event-points", e => { const id = e.features?.[0]?.properties?.['id']; if (typeof id === "string") useApp.getState().select(id); });
      map.on("click", "footprint-fill", e => { const id = e.features?.[0]?.properties?.['id']; if (typeof id === "string") useApp.getState().select(id); });
      map.on("click", "live-event-points", e => { const id = e.features?.[0]?.properties?.["id"]; if (typeof id === "string") useApp.getState().select(id); });
      map.on("mouseenter", "live-event-points", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "live-event-points", () => { map.getCanvas().style.cursor = "grab"; });
      map.on("mouseenter", "event-points", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "event-points", () => { map.getCanvas().style.cursor = "grab"; });
    });
    map.on("moveend", () => { const center = map.getCenter(); useApp.getState().syncView({ lat: center.lat, lng: center.lng, altitude: Math.pow(2, 4 - map.getZoom()) / 4 }); });
    return () => { map.remove(); mapRef.current = null; };
  }, []);
  useEffect(update, [layers, filter, time, lod, selected, opacity, liveEvents]);
  useEffect(() => { const view = useApp.getState().view; mapRef.current?.flyTo({ center: [view.lng, view.lat], zoom: Math.max(1, 4 - Math.log2(view.altitude * 4)), duration: 1500, essential: false }); }, [nonce]);
  return <div ref={el} className="absolute inset-0 earth-renderer" data-earth-engine="maplibre"><div className="earth-attribution">Esri · Maxar · Earthstar Geographics · USGS/NASA live feeds · NISAR overlays are sample-only</div></div>;
}
