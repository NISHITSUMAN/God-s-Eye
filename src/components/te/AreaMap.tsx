import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useApp } from "@/lib/store";
import { circleAOI, distanceKm, makeAOI, polygonAOI, rectangleAOI, type DrawTool } from "@/lib/analysis";
import type { Position } from "geojson";

type MapStatus = "loading" | "ready" | "fallback" | "error";

const MAPS = [
  { id: "osm", label: "OpenStreetMap", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors" },
  { id: "carto", label: "CARTO Dark", url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors © CARTO" },
  { id: "esri", label: "Esri World Imagery", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "Tiles © Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community" },
] as const;

export default function AreaMap({ tool }: { tool: DrawTool | null }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const points = useRef<Position[]>([]);
  const toolRef = useRef(tool);
  const probeRef = useRef<((index: number) => void) | null>(null);
  const aoi = useApp(state => state.aoi);
  const layers = useApp(state => state.layers);
  const time = useApp(state => state.time);
  const nisarGranules = useApp(state => state.nisarGranules);
  const [ready, setReady] = useState(false);
  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");
  const [mapError, setMapError] = useState<string | null>(null);
  const [drawingError, setDrawingError] = useState<string | null>(null);

  useEffect(() => {
    toolRef.current = tool;
    points.current = [];
    setDrawingError(null);
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = tool ? "crosshair" : "grab";
  }, [tool]);

  useEffect(() => {
    if (!el.current) return;
    let cancelled = false;
    let activeIndex = 0;
    setReady(false);
    setMapStatus("loading");
    setMapError(null);
    const sources: Record<string, maplibregl.SourceSpecification> = {};
    const baseLayers: maplibregl.LayerSpecification[] = [];
    MAPS.forEach((item, index) => {
      sources[`base-${item.id}`] = {
        type: "raster",
        tiles: [item.url],
        tileSize: 256,
        attribution: item.attribution,
      };
      baseLayers.push({
        id: `base-layer-${item.id}`,
        type: "raster",
        source: `base-${item.id}`,
        layout: { visibility: index === 0 ? "visible" : "none" },
      });
    });

    const view = useApp.getState().view;
    const map = new maplibregl.Map({
      container: el.current,
      center: [view.lng, view.lat],
      zoom: 4,
      minZoom: 1,
      maxZoom: 18,
      attributionControl: { compact: true },
      style: { version: 8, sources, layers: baseLayers },
    });
    mapRef.current = map;

    const activate = (index: number) => {
      const mapConfig = MAPS[index];
      if (!mapConfig) return;
      activeIndex = index;
      MAPS.forEach((item, layerIndex) => {
        const id = `base-layer-${item.id}`;
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", layerIndex === index ? "visible" : "none");
      });
      if (index === 0) {
        setMapStatus("loading");
        setMapError(null);
      } else {
        setMapStatus("fallback");
        setMapError(`The previous basemap failed. Trying ${mapConfig.label}.`);
      }
      map.resize();
      map.triggerRepaint();
    };

    const probe = (index: number) => {
      if (cancelled) return;
      if (index >= MAPS.length) {
        setMapStatus("error");
        setMapError("All free basemap sources failed. Check your connection and retry.");
        return;
      }
      const mapConfig = MAPS[index];
      if (!mapConfig) {
        setMapStatus("error");
        setMapError("The requested map source is unavailable.");
        return;
      }
      activate(index);
      const image = new Image();
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled || cancelled || activeIndex !== index) return;
        settled = true;
        probe(index + 1);
      }, 9000);
      image.onload = () => {
        if (settled || cancelled || activeIndex !== index) return;
        settled = true;
        window.clearTimeout(timer);
        setMapStatus(index === 0 ? "ready" : "fallback");
        setMapError(null);
        if (index > 0) window.setTimeout(() => { if (!cancelled) setMapStatus(status => status === "fallback" ? "ready" : status); }, 2500);
      };
      image.onerror = () => {
        if (settled || cancelled || activeIndex !== index) return;
        settled = true;
        window.clearTimeout(timer);
        probe(index + 1);
      };
      image.src = mapConfig.url.replace("{z}", "0").replace("{x}", "0").replace("{y}", "0");
    };
    probeRef.current = probe;

    map.on("error", (event) => {
      const error = event as { sourceId?: string; error?: { message?: string; url?: string } };
      const sourceId = error.sourceId ?? "";
      const message = `${error.error?.message ?? ""} ${error.error?.url ?? ""}`;
      const isActiveSource = sourceId === `base-${MAPS[activeIndex]!.id}` ||
        message.includes(new URL(MAPS[activeIndex]!.url).hostname);
      if (isActiveSource && activeIndex < MAPS.length - 1) probe(activeIndex + 1);
    });

    const updateNISAR = () => {
      if (!map.isStyleLoaded() || !map.getSource("nisar-coverage")) return;
      const state = useApp.getState();
      const features = state.nisarGranules.flatMap(granule => {
        if (!state.layers.has("nisar-coverage") || !state.layers.has(`prod-${granule.productCode}`) || !granule.bounds) return [];
        const day = (granule.startDate || "").slice(0, 10);
        if (day && (day < state.time.start || day > state.time.end || day > state.time.current)) return [];
        const coordinates: [number, number][] = granule.footprint && granule.footprint.length >= 3
          ? [...granule.footprint, granule.footprint[0]!]
          : [
              [granule.bounds.west, granule.bounds.south],
              [granule.bounds.east, granule.bounds.south],
              [granule.bounds.east, granule.bounds.north],
              [granule.bounds.west, granule.bounds.north],
              [granule.bounds.west, granule.bounds.south],
            ];
        return [{
          type: "Feature" as const,
          properties: { id: granule.id, product: granule.productCode, date: day },
          geometry: { type: "Polygon" as const, coordinates: [coordinates] },
        }];
      });
      (map.getSource("nisar-coverage") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features });
    };

    map.on("load", () => {
      map.resize();
      window.requestAnimationFrame(() => map.resize());
      const color = getComputedStyle(document.documentElement).getPropertyValue("--earth-selection").trim() || "#25D9FF";
      map.addSource("india-admin", { type: "geojson", data: "/data/jammu-kashmir-ladakh.geojson" });
      map.addLayer({ id: "india-admin-fill", type: "fill", source: "india-admin", paint: { "fill-color": "#FF9933", "fill-opacity": 0.12 } });
      map.addLayer({ id: "india-admin-outline", type: "line", source: "india-admin", paint: { "line-color": "#FF9933", "line-width": 3, "line-opacity": 0.98 } });
      map.addSource("nisar-coverage", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "nisar-coverage-fill", type: "fill", source: "nisar-coverage", paint: { "fill-color": "#2EC4FF", "fill-opacity": 0.09 } });
      map.addLayer({ id: "nisar-coverage-outline", type: "line", source: "nisar-coverage", paint: { "line-color": "#2EC4FF", "line-width": 1.7, "line-opacity": 0.95 } });
      map.addSource("aoi", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "aoi-fill", type: "fill", source: "aoi", paint: { "fill-color": color, "fill-opacity": 0.15 } });
      map.addLayer({ id: "aoi-line", type: "line", source: "aoi", paint: { "line-color": color, "line-width": 2.5 } });
      map.addLayer({ id: "aoi-point", type: "circle", source: "aoi", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": color, "circle-radius": 6 } });
      map.on("click", event => {
        const selected = map.queryRenderedFeatures(event.point, { layers: ["nisar-coverage-fill", "nisar-coverage-outline"] });
        const id = selected[0]?.properties?.["id"];
        if (typeof id === "string") {
          useApp.getState().select(id);
          return;
        }
        const activeTool = toolRef.current;
        if (!activeTool) return;
        const point: Position = [event.lngLat.lng, event.lngLat.lat];
        setDrawingError(null);
        try {
          if (activeTool === "point") {
            useApp.getState().setAOI(makeAOI({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: point } }, "Point AOI"));
            return;
          }
          points.current.push(point);
          if (activeTool === "rectangle" && points.current.length === 2) {
            const first = points.current[0];
            if (first) useApp.getState().setAOI(rectangleAOI(first, point));
            points.current = [];
          }
          if (activeTool === "circle" && points.current.length === 2) {
            const first = points.current[0];
            if (first) useApp.getState().setAOI(circleAOI(first, distanceKm(first, point)));
            points.current = [];
          }
          if (activeTool === "polygon" && points.current.length >= 3) {
            useApp.getState().setAOI(polygonAOI(points.current));
          }
        } catch (error) {
          points.current = [];
          setDrawingError(error instanceof Error ? error.message : "Could not create an area from those points.");
        }
      });
      const labels = [
        { text: "JAMMU & KASHMIR · INDIA", point: [74.95, 34] as [number, number] },
        { text: "LADAKH · INDIA", point: [78, 34.6] as [number, number] },
      ];
      labels.forEach(({ text, point }) => {
        const element = document.createElement("div");
        element.className = "india-boundary-label";
        element.textContent = text;
        new maplibregl.Marker({ element, anchor: "center" }).setLngLat(point).addTo(map);
      });
      setReady(true);
      updateNISAR();
      probe(activeIndex);
    });

    return () => {
      cancelled = true;
      probeRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    (map.getSource("aoi") as maplibregl.GeoJSONSource | undefined)?.setData(aoi?.feature ?? { type: "FeatureCollection", features: [] });
  }, [aoi, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    const state = useApp.getState();
    const dayFeatures = state.nisarGranules.flatMap(granule => {
      if (!state.layers.has("nisar-coverage") || !state.layers.has(`prod-${granule.productCode}`) || !granule.bounds) return [];
      const day = (granule.startDate || "").slice(0, 10);
      if (day && (day < state.time.start || day > state.time.end || day > state.time.current)) return [];
      const coords: [number, number][] = granule.footprint && granule.footprint.length >= 3
        ? [...granule.footprint, granule.footprint[0]!]
        : [
            [granule.bounds.west, granule.bounds.south],
            [granule.bounds.east, granule.bounds.south],
            [granule.bounds.east, granule.bounds.north],
            [granule.bounds.west, granule.bounds.north],
            [granule.bounds.west, granule.bounds.south],
          ];
      return [{
        type: "Feature" as const,
        properties: { id: granule.id, product: granule.productCode, date: day },
        geometry: { type: "Polygon" as const, coordinates: [coords] },
      }];
    });
    (map.getSource("nisar-coverage") as maplibregl.GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: dayFeatures });
  }, [ready, nisarGranules, layers, time]);

  const retryMap = () => {
    const map = mapRef.current;
    if (!map || !probeRef.current) {
      window.location.reload();
      return;
    }
    probeRef.current(0);
  };

  return <div className="relative h-[460px] min-h-[320px] border-y border-border">
    <div ref={el} className="absolute inset-0" data-area-map="true" />
    {(!ready || mapStatus === "loading" || mapStatus === "fallback") && (
      <div className="earth-map-status label-xs" role="status">{mapStatus === "fallback" ? "SWITCHING MAP SOURCE…" : "LOADING AREA MAP…"}</div>
    )}
    {mapStatus === "error" && <div className="earth-map-status earth-map-status-error glass" role="status"><p>{mapError}</p><button type="button" onClick={retryMap}>RETRY MAP</button></div>}
    {tool && <div className="absolute left-3 top-3 z-10 glass px-3 py-2 text-xs">{tool === "polygon" ? "POLYGON · select vertices" : tool === "point" ? "SELECT POINT" : `${tool.toUpperCase()} · select two points`}</div>}
    {drawingError && <div role="alert" className="absolute left-3 right-3 top-14 z-10 glass border-alert px-3 py-2 text-xs text-alert">{drawingError}</div>}
    <div className="absolute bottom-3 left-3 z-10 rounded bg-background/80 px-2 py-1 font-mono text-[9px] text-muted-foreground">KASHMIR & LADAKH · INDIA BOUNDARY OVERLAY · NASA CMR NISAR COVERAGE</div>
  </div>;
}
