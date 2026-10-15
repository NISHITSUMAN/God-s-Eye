import { useEffect, useRef, useState } from "react";
import maplibregl, { type RasterSourceSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useApp, visibleEvents } from "@/lib/store";
import { eventOpacity } from "@/lib/earth-data";
import { phenomenonColor } from "@/lib/mock-data";
import type { NISARGranule } from "@/lib/nasa-cmr";

type MapStatus = "loading" | "ready" | "fallback" | "error";

const BASEMAPS: { id: string; label: string; source: RasterSourceSpecification }[] = [
  {
    id: "osm",
    label: "OpenStreetMap",
    source: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  {
    id: "carto",
    label: "CARTO Dark",
    source: {
      type: "raster" as const,
      tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  {
    id: "esri",
    label: "Esri World Imagery",
    source: {
      type: "raster" as const,
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Tiles © Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  },
];

export default function EarthMap({ compact = false }: { compact?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const activeBasemapRef = useRef(0);
  const probeBasemapRef = useRef<((index: number) => void) | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");
  const [mapError, setMapError] = useState("");
  const layers = useApp(s => s.layers);
  const filter = useApp(s => s.filter);
  const time = useApp(s => s.time);
  const lod = useApp(s => s.lod);
  const selected = useApp(s => s.selectedId);
  const nonce = useApp(s => s.viewNonce);
  const opacity = useApp(s => s.opacity);
  const liveEvents = useApp(s => s.liveEvents);
  const nisarGranules = useApp(s => s.nisarGranules);

  const update = () => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;

    const state = useApp.getState();
    const events = visibleEvents(state);
    const pointData = {
      type: "FeatureCollection" as const,
      features: events.map(event => ({
        type: "Feature" as const,
        properties: {
          id: event.id,
          color: phenomenonColor(event.type),
          alpha: eventOpacity(event) * ((state.opacity[event.type] ?? 100) / 100),
          selected: event.id === state.selectedId,
        },
        geometry: { type: "Point" as const, coordinates: [event.lng, event.lat] },
      })),
    };
    const polygonData = {
      type: "FeatureCollection" as const,
      features: state.layers.has("nisar-footprints")
        ? events.map(event => ({
            type: "Feature" as const,
            properties: { id: event.id, selected: event.id === state.selectedId },
            geometry: {
              type: "Polygon" as const,
              coordinates: [[
                ...event.geometry.coordinates,
                ...(event.geometry.coordinates[0] ? [event.geometry.coordinates[0]] : []),
              ].map(point => [point.lng, point.lat])],
            },
          }))
        : [],
    };
    (map.getSource("events") as maplibregl.GeoJSONSource | undefined)?.setData(pointData);
    (map.getSource("footprints") as maplibregl.GeoJSONSource | undefined)?.setData(polygonData);

    const liveFeatures = state.liveEvents.filter(event => {
      if (!state.layers.has(event.layerId)) return false;
      if (state.filter.types && !state.filter.types.includes(event.type)) return false;
      if (state.filter.region && !`${event.region} ${event.country}`.toLowerCase().includes(state.filter.region.toLowerCase())) return false;
      const day = event.date.slice(0, 10);
      return day >= state.time.start && day <= state.time.end && day <= state.time.current;
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
    (map.getSource("live-events") as maplibregl.GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: liveFeatures,
    });

    const nisarFeatures = state.nisarGranules.flatMap((granule) => {
      if (!state.layers.has("nisar-coverage") || !state.layers.has(`prod-${granule.productCode}`) || !granule.bounds) return [];
      const day = (granule.startDate || "").slice(0, 10);
      if (day && (day < state.time.start || day > state.time.end || day > state.time.current)) return [];
      const coordinates = granule.footprint && granule.footprint.length >= 3
        ? [...granule.footprint, granule.footprint[0]!].map(point => [point[0], point[1]])
        : [
            [granule.bounds.west, granule.bounds.south],
            [granule.bounds.east, granule.bounds.south],
            [granule.bounds.east, granule.bounds.north],
            [granule.bounds.west, granule.bounds.north],
            [granule.bounds.west, granule.bounds.south],
          ];
      return [{
        type: "Feature" as const,
        properties: {
          id: granule.id,
          title: granule.granuleId,
          productCode: granule.productCode,
          date: day,
          browseUrl: granule.browseUrl || "",
        },
        geometry: { type: "Polygon" as const, coordinates: [coordinates] },
      }];
    });
    (map.getSource("nisar-coverage") as maplibregl.GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: nisarFeatures,
    });
  };

  useEffect(() => {
    if (!el.current) return;
    let map: maplibregl.Map;
    activeBasemapRef.current = 0;
    setMapStatus("loading");
    setMapError("");

    const sources: Record<string, maplibregl.SourceSpecification> = {};
    const styleLayers: maplibregl.LayerSpecification[] = [];
    BASEMAPS.forEach((basemap, index) => {
      sources[`base-${basemap.id}`] = { ...basemap.source, tiles: [...(basemap.source.tiles ?? [])] };
      styleLayers.push({
        id: `base-layer-${basemap.id}`,
        type: "raster",
        source: `base-${basemap.id}`,
        layout: { visibility: index === 0 ? "visible" : "none" },
      });
    });

    const view = useApp.getState().view;
    try {
      map = new maplibregl.Map({
        container: el.current,
        center: [view.lng, view.lat],
        zoom: Math.max(1, 4 - Math.log2(view.altitude * 4)),
        attributionControl: { compact: true },
        style: { version: 8, sources, layers: styleLayers },
        maxZoom: 18,
        minZoom: 1,
        trackResize: true,
      });
    } catch (error) {
      setMapStatus("error");
      setMapError(error instanceof Error ? error.message : "The 2D map could not be started in this browser.");
      return;
    }
    mapRef.current = map;

    const setActiveBasemap = (index: number) => {
      const validIndex = Math.max(0, Math.min(BASEMAPS.length - 1, index));
      const mapConfig = BASEMAPS[validIndex];
      if (!mapConfig) return;
      activeBasemapRef.current = validIndex;
      BASEMAPS.forEach((basemap, layerIndex) => {
        const layerId = `base-layer-${basemap.id}`;
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, "visibility", layerIndex === validIndex ? "visible" : "none");
        }
      });
      if (validIndex === 0) {
        setMapStatus("loading");
        setMapError("");
      } else {
        setMapStatus("fallback");
        setMapError(`The previous map tile source failed. Trying ${mapConfig.label}.`);
      }
      map.resize();
      map.triggerRepaint();
    };

    const probeBasemap = (index: number) => {
      if (index >= BASEMAPS.length) {
        setMapStatus("error");
        setMapError("All free map tile sources failed to load. Check your connection and try again.");
        return;
      }
      const mapConfig = BASEMAPS[index];
      if (!mapConfig) {
        setMapStatus("error");
        setMapError("The requested map source is unavailable.");
        return;
      }
      setActiveBasemap(index);
      const tileTemplate = mapConfig.source.tiles?.[0];
      if (!tileTemplate) {
        probeBasemap(index + 1);
        return;
      }

      // Probe a tiny world tile independently of MapLibre's render loop. This gives us
      // a reliable fallback path even on MapLibre versions that omit sourceId on errors.
      const image = new Image();
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled || activeBasemapRef.current !== index) return;
        settled = true;
        probeBasemap(index + 1);
      }, 9000);
      image.onload = () => {
        if (settled || activeBasemapRef.current !== index) return;
        settled = true;
        window.clearTimeout(timer);
        setMapStatus(index === 0 ? "ready" : "fallback");
        setMapError("");
      };
      image.onerror = () => {
        if (settled || activeBasemapRef.current !== index) return;
        settled = true;
        window.clearTimeout(timer);
        console.warn(`2D basemap ${mapConfig.label} failed its tile probe.`);
        probeBasemap(index + 1);
      };
      image.src = tileTemplate.replace("{z}", "0").replace("{x}", "0").replace("{y}", "0");
    };
    probeBasemapRef.current = probeBasemap;

    const onMapError = (event: unknown) => {
      const detail = event as { error?: { message?: string; url?: string } };
      const message = `${detail.error?.message ?? ""} ${detail.error?.url ?? ""}`;
      const active = BASEMAPS[activeBasemapRef.current];
      const activeTile = active?.source.tiles?.[0];
      const host = activeTile ? new URL(activeTile).hostname : "";
      // Ignore unrelated style/data errors; the tile probe handles generic network failures.
      if (!host || !message.includes(host)) return;
      const nextIndex = activeBasemapRef.current + 1;
      if (nextIndex < BASEMAPS.length) probeBasemap(nextIndex);
      else {
        setMapStatus("error");
        setMapError("All free map tile sources failed to load. Check your connection and try again.");
      }
    };
    map.on("error", onMapError);

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => map.resize())
      : null;
    if (resizeObserver && el.current) resizeObserver.observe(el.current);
    map.on("load", () => {
      setMapStatus("loading");
      map.resize();
      window.requestAnimationFrame(() => map.resize());

      const selection = getComputedStyle(document.documentElement).getPropertyValue("--earth-selection").trim() || "#25D9FF";
      map.addSource("events", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("footprints", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("live-events", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("nisar-coverage", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("india-admin", { type: "geojson", data: "/data/jammu-kashmir-ladakh.geojson" });
      map.addLayer({
        id: "india-admin-fill",
        type: "fill",
        source: "india-admin",
        paint: { "fill-color": "#FF9933", "fill-opacity": 0.12 },
      });
      map.addLayer({
        id: "india-admin-outline",
        type: "line",
        source: "india-admin",
        paint: {
          "line-color": "#FF9933",
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.6, 7, 3.2, 10, 4],
          "line-opacity": 0.98,
        },
      });
      map.addLayer({
        id: "nisar-coverage-fill",
        type: "fill",
        source: "nisar-coverage",
        paint: { "fill-color": "#2EC4FF", "fill-opacity": 0.1 },
      });
      map.addLayer({
        id: "nisar-coverage-outline",
        type: "line",
        source: "nisar-coverage",
        paint: {
          "line-color": "#2EC4FF",
          "line-width": ["case", ["get", "selected"], 3, 1.2],
          "line-opacity": 0.92,
        },
      });
      map.addLayer({
        id: "footprint-fill",
        type: "fill",
        source: "footprints",
        paint: { "fill-color": selection, "fill-opacity": 0.07 },
      });
      map.addLayer({
        id: "footprint-outline",
        type: "line",
        source: "footprints",
        paint: {
          "line-color": selection,
          "line-width": ["case", ["get", "selected"], 2, 1],
          "line-opacity": 0.65,
        },
      });
      map.addLayer({
        id: "event-points",
        type: "circle",
        source: "events",
        paint: {
          "circle-color": ["get", "color"],
          "circle-opacity": ["get", "alpha"],
          "circle-radius": ["case", ["get", "selected"], 7, 4],
          "circle-stroke-color": selection,
          "circle-stroke-width": ["case", ["get", "selected"], 2, 0],
        },
      });
      map.addLayer({
        id: "live-event-points",
        type: "circle",
        source: "live-events",
        paint: {
          "circle-color": ["get", "color"],
          "circle-opacity": 0.92,
          "circle-radius": 6,
          "circle-stroke-color": "#F7FAFC",
          "circle-stroke-width": 1.5,
        },
      });
      update();

      map.on("click", "event-points", event => {
        const id = event.features?.[0]?.properties?.["id"];
        if (typeof id === "string") useApp.getState().select(id);
      });
      map.on("click", "footprint-fill", event => {
        const id = event.features?.[0]?.properties?.["id"];
        if (typeof id === "string") useApp.getState().select(id);
      });
      map.on("click", "live-event-points", event => {
        const id = event.features?.[0]?.properties?.["id"];
        if (typeof id === "string") useApp.getState().select(id);
      });
      map.on("click", "nisar-coverage-fill", event => {
        const id = event.features?.[0]?.properties?.["id"];
        if (typeof id === "string") useApp.getState().select(id);
      });
      map.on("click", "nisar-coverage-outline", event => {
        const id = event.features?.[0]?.properties?.["id"];
        if (typeof id === "string") useApp.getState().select(id);
      });
      map.on("mouseenter", "nisar-coverage-fill", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "nisar-coverage-fill", () => { map.getCanvas().style.cursor = "grab"; });
      map.on("mouseenter", "live-event-points", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "live-event-points", () => { map.getCanvas().style.cursor = "grab"; });
      map.on("mouseenter", "event-points", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "event-points", () => { map.getCanvas().style.cursor = "grab"; });
      probeBasemap(activeBasemapRef.current);

      // Labels make the Indian official boundary depiction explicit at Kashmir-level zoom.
      const indiaLabels = [
        { text: "JAMMU & KASHMIR · INDIA", lng: 74.95, lat: 34.0 },
        { text: "LADAKH · INDIA", lng: 78.0, lat: 34.6 },
      ];
      indiaLabels.forEach(({ text, lng, lat }) => {
        const element = document.createElement("div");
        element.className = "india-boundary-label";
        element.textContent = text;
        const marker = new maplibregl.Marker({ element, anchor: "center" }).setLngLat([lng, lat]).addTo(map);
        const updateVisibility = () => {
          element.style.display = map.getZoom() >= 3.8 ? "block" : "none";
        };
        map.on("zoom", updateVisibility);
        updateVisibility();
        // The map owns the DOM marker lifetime; on teardown MapLibre removes it.
        void marker;
      });
    });

    map.on("moveend", () => {
      const center = map.getCenter();
      useApp.getState().syncView({
        lat: center.lat,
        lng: center.lng,
        altitude: Math.pow(2, 4 - map.getZoom()) / 4,
      });
    });

    return () => {
      resizeObserver?.disconnect();
      probeBasemapRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(update, [layers, filter, time, lod, selected, opacity, liveEvents, nisarGranules]);

  useEffect(() => {
    const view = useApp.getState().view;
    mapRef.current?.flyTo({
      center: [view.lng, view.lat],
      zoom: Math.max(1, 4 - Math.log2(view.altitude * 4)),
      duration: 1000,
      essential: false,
    });
  }, [nonce]);

  useEffect(() => {
    if (mapStatus !== "fallback") return;
    const timer = window.setTimeout(() => {
      setMapStatus(status => status === "fallback" ? "ready" : status);
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [mapStatus]);

  const retryBasemap = () => {
    const map = mapRef.current;
    setMapError("");
    if (!map || !probeBasemapRef.current) {
      window.location.reload();
      return;
    }
    map.resize();
    probeBasemapRef.current(0);
  };

  return (
    <div ref={el} className={compact ? "absolute inset-0 earth-renderer earth-renderer-compact" : "absolute inset-0 earth-renderer"} data-earth-engine="maplibre">
      {mapStatus === "loading" && (
        <div className="earth-map-status label-xs" role="status">LOADING 2D MAP…</div>
      )}
      {mapStatus === "fallback" && (
        <div className="earth-map-status label-xs" role="status">SWITCHING TO BACKUP MAP…</div>
      )}
      {mapStatus === "error" && (
        <div className="earth-map-status earth-map-status-error glass" role="status">
          <p>{mapError || "The map could not be loaded."}</p>
          <button type="button" onClick={retryBasemap}>RETRY MAP</button>
        </div>
      )}
      <div className="earth-attribution">NISAR coverage: NASA CMR / ASF · J&amp;K / Ladakh boundary: India-aligned open dataset · Sample candidates remain illustrative</div>
    </div>
  );
}
