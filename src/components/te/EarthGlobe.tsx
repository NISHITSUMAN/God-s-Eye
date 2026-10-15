import { useEffect, useRef, useState } from "react";
import {
  Viewer,
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  EllipsoidTerrainProvider,
  Ellipsoid,
  Math as CesiumMath,
  PolygonHierarchy,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  ArcType,
  JulianDate,
  UrlTemplateImageryProvider,
  TileMapServiceImageryProvider,
  Ion,
  IonImageryProvider,
  createWorldTerrainAsync,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { useApp, visibleEvents } from "@/lib/store";
import { eventOpacity } from "@/lib/earth-data";
import { phenomenonColor } from "@/lib/mock-data";

const ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
const ION_IMAGERY_ASSET_ID = Number(import.meta.env.VITE_CESIUM_ION_IMAGERY_ASSET_ID || 2);
const CUSTOM_IMAGERY_URL = import.meta.env.VITE_EARTH_IMAGERY_URL as string | undefined;
const CUSTOM_IMAGERY_ATTRIBUTION = import.meta.env.VITE_EARTH_IMAGERY_ATTRIBUTION as string | undefined;
const USE_ION_TERRAIN = String(import.meta.env.VITE_CESIUM_TERRAIN || "false").toLowerCase() === "true";

function esriWorldImagery() {
  return new UrlTemplateImageryProvider({
    // ArcGIS REST uses z/y/x order. Cesium substitutes these template variables by name.
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    credit: "Tiles © Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maximumLevel: 19,
  });
}

function configuredImagery() {
  if (!CUSTOM_IMAGERY_URL) return null;
  return new UrlTemplateImageryProvider({
    url: CUSTOM_IMAGERY_URL,
    credit: CUSTOM_IMAGERY_ATTRIBUTION || "Configured imagery provider",
    maximumLevel: 22,
  });
}

export default function EarthGlobe() {
  const container = useRef<HTMLDivElement>(null);
  const ref = useRef<Viewer | null>(null);
  const [viewerInstance, setViewerInstance] = useState<Viewer | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageryLabel, setImageryLabel] = useState("Loading imagery");
  const layers = useApp(s => s.layers);
  const filter = useApp(s => s.filter);
  const time = useApp(s => s.time);
  const lod = useApp(s => s.lod);
  const opacity = useApp(s => s.opacity);
  const selected = useApp(s => s.selectedId);
  const liveEvents = useApp(s => s.liveEvents);
  const nonce = useApp(s => s.viewNonce);
  const ds = useRef<CustomDataSource | null>(null);

  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    let fallbackBusy = false;
    let activeProvider: UrlTemplateImageryProvider | IonImageryProvider | undefined;
    let activeLayer: ReturnType<Viewer["imageryLayers"]["addImageryProvider"]> | undefined;
    const token = ION_TOKEN?.trim();
    if (token) Ion.defaultAccessToken = token;

    const viewer = new Viewer(container.current, {
      baseLayer: false,
      terrainProvider: new EllipsoidTerrainProvider(),
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
    });
    ref.current = viewer;
    setViewerInstance(viewer);

    const naturalEarthFallback = async () => {
      if (cancelled || viewer.isDestroyed()) return;
      try {
        const provider = await TileMapServiceImageryProvider.fromUrl("/cesium/Assets/Textures/NaturalEarthII");
        if (cancelled || viewer.isDestroyed()) return;
        if (activeLayer) viewer.imageryLayers.remove(activeLayer, true);
        activeLayer = viewer.imageryLayers.addImageryProvider(provider);
        activeProvider = undefined;
        setImageryLabel("Natural Earth II fallback");
        setReady(true);
        setError("High-resolution imagery is unavailable; using a low-resolution global fallback.");
      } catch (fallbackError) {
        console.error("Bundled Earth fallback could not be loaded.", fallbackError);
        setError("Earth imagery could not be loaded. Check your network and imagery provider settings.");
      }
    };

    const installEsriFallback = (notice?: string) => {
      if (cancelled || viewer.isDestroyed()) return;
      const provider = esriWorldImagery();
      if (activeLayer) viewer.imageryLayers.remove(activeLayer, true);
      activeLayer = viewer.imageryLayers.addImageryProvider(provider);
      activeProvider = provider;
      setImageryLabel("Esri World Imagery");
      setReady(true);
      setError(notice ?? null);
      provider.errorEvent.addEventListener((tileError) => {
        if (cancelled || viewer.isDestroyed() || activeProvider !== provider || fallbackBusy || tileError.timesRetried < 2) return;
        fallbackBusy = true;
        void naturalEarthFallback().finally(() => { fallbackBusy = false; });
      });
    };

    const installConfigured = (provider: UrlTemplateImageryProvider | IonImageryProvider, label: string) => {
      if (cancelled || viewer.isDestroyed()) return;
      if (activeLayer) viewer.imageryLayers.remove(activeLayer, true);
      activeLayer = viewer.imageryLayers.addImageryProvider(provider);
      activeProvider = provider;
      setImageryLabel(label);
      setReady(true);
      setError(null);
      provider.errorEvent.addEventListener((tileError) => {
        if (cancelled || viewer.isDestroyed() || activeProvider !== provider || fallbackBusy || tileError.timesRetried < 2) return;
        fallbackBusy = true;
        installEsriFallback("The configured imagery source failed; switched to Esri World Imagery.");
        fallbackBusy = false;
      });
    };

    const loadImagery = async () => {
      const custom = configuredImagery();
      if (custom) {
        installConfigured(custom, CUSTOM_IMAGERY_ATTRIBUTION || "Configured imagery");
        return;
      }
      if (token) {
        try {
          const provider = await IonImageryProvider.fromAssetId(ION_IMAGERY_ASSET_ID);
          if (cancelled || viewer.isDestroyed()) return;
          installConfigured(provider, "Cesium ion imagery");
          return;
        } catch (ionError) {
          console.warn("Cesium ion imagery unavailable; using public imagery fallback.", ionError);
        }
      }
      if (!cancelled && !viewer.isDestroyed()) installEsriFallback();
    };
    void loadImagery();

    if (USE_ION_TERRAIN && token) {
      void createWorldTerrainAsync().then(terrain => {
        if (!cancelled && !viewer.isDestroyed()) {
          viewer.terrainProvider = terrain;
          viewer.scene.globe.depthTestAgainstTerrain = true;
          viewer.scene.requestRender();
        }
      }).catch(terrainError => {
        console.warn("Optional terrain is unavailable; retaining ellipsoid terrain.", terrainError);
      });
    }

    const source = new CustomDataSource("Third Eye sample observations");
    ds.current = source;
    void viewer.dataSources.add(source);
    viewer.scene.backgroundColor = Color.fromCssColorString(getComputedStyle(document.documentElement).getPropertyValue("--earth-space").trim() || "#050A0F");
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
    if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
    if (viewer.scene.sun) viewer.scene.sun.show = false;
    if (viewer.scene.moon) viewer.scene.moon.show = false;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 80;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 35000000;
    viewer.camera.percentageChanged = 0.02;
    const view = useApp.getState().view;
    viewer.camera.setView({ destination: Cartesian3.fromDegrees(view.lng, view.lat, view.altitude * Ellipsoid.WGS84.maximumRadius) });

    const removeCamera = viewer.camera.moveEnd.addEventListener(() => {
      const pos = viewer.camera.positionCartographic;
      useApp.getState().syncView({ lat: CesiumMath.toDegrees(pos.latitude), lng: CesiumMath.toDegrees(pos.longitude), altitude: pos.height / Ellipsoid.WGS84.maximumRadius });
    });
    let lastInteraction = Date.now();
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((event: { position: Cartesian2 }) => {
      lastInteraction = Date.now();
      const picked = viewer.scene.pick(event.position);
      const id = picked?.id?.properties?.eventId?.getValue(JulianDate.now());
      if (typeof id === "string") useApp.getState().select(id);
    }, ScreenSpaceEventType.LEFT_CLICK);
    handler.setInputAction((event: { endPosition: Cartesian2 }) => {
      const picked = viewer.scene.pick(event.endPosition);
      const id = picked?.id?.properties?.eventId?.getValue(JulianDate.now());
      useApp.getState().setHovered(typeof id === "string" ? id : null);
      viewer.scene.canvas.style.cursor = id ? "pointer" : "grab";
    }, ScreenSpaceEventType.MOUSE_MOVE);
    const markInteraction = () => { lastInteraction = Date.now(); };
    viewer.scene.canvas.addEventListener("pointerdown", markInteraction);
    viewer.scene.canvas.addEventListener("wheel", markInteraction);
    let previous = performance.now();
    const removeTick = viewer.clock.onTick.addEventListener(() => {
      const now = performance.now();
      const delta = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      if (!useApp.getState().selectedId && Date.now() - lastInteraction > 12000 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) viewer.camera.rotateRight(delta * 0.003);
    });

    return () => {
      cancelled = true;
      handler.destroy();
      removeCamera();
      removeTick();
      if (!viewer.isDestroyed()) {
        viewer.scene.canvas.removeEventListener("pointerdown", markInteraction);
        viewer.scene.canvas.removeEventListener("wheel", markInteraction);
        viewer.dataSources.remove(source, true);
        viewer.destroy();
      }
      ref.current = null;
      ds.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = ref.current;
    if (!viewer || !ready) return;
    const view = useApp.getState().view;
    viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(view.lng, view.lat, view.altitude * Ellipsoid.WGS84.maximumRadius), duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1.6 });
  }, [nonce, ready]);

  useEffect(() => {
    const source = ds.current;
    if (!source || !ready) return;
    source.entities.removeAll();
    const css = getComputedStyle(document.documentElement);
    const system = Color.fromCssColorString(css.getPropertyValue("--earth-selection").trim() || "#25D9FF");
    source.clustering.enabled = lod === "global";
    source.clustering.pixelRange = 32;
    source.clustering.minimumClusterSize = 3;
    const events = visibleEvents({ layers, filter, time, lod });
    for (const event of events) {
      const chosen = event.id === selected;
      const alpha = eventOpacity(event) * ((opacity[event.type] ?? 100) / 100) * (selected && !chosen ? 0.65 : 1);
      const color = chosen ? system : Color.fromCssColorString(phenomenonColor(event.type)).withAlpha(alpha);
      source.entities.add({ id: event.id, name: `${event.title} · ${event.region} · SAMPLE DATA`, properties: { eventId: event.id }, position: Cartesian3.fromDegrees(event.lng, event.lat, 200), point: { pixelSize: chosen ? 11 : lod === "global" ? 5 : lod === "regional" ? 7 : 9, color, outlineColor: chosen ? system : color.withAlpha(0.5), outlineWidth: chosen ? 3 : 1, disableDepthTestDistance: Number.POSITIVE_INFINITY } });
      if (layers.has("nisar-footprints") && (lod !== "global" || chosen)) {
        const coords = event.geometry.coordinates;
        source.entities.add({ id: `${event.id}-polygon`, properties: { eventId: event.id }, polygon: { hierarchy: new PolygonHierarchy(coords.map(p => Cartesian3.fromDegrees(p.lng, p.lat))), material: color.withAlpha(chosen ? 0.18 : 0.055), height: 100, outline: false }, polyline: { positions: [...coords, ...(coords[0] ? [coords[0]] : [])].map(p => Cartesian3.fromDegrees(p.lng, p.lat, 110)), width: chosen ? 2 : 1, material: chosen ? system : system.withAlpha(0.4 * ((opacity["nisar-footprints"] ?? 100) / 100)), arcType: ArcType.GEODESIC } });
      }
      if (layers.has("nisar-tracks") && (lod !== "global" || chosen)) {
        source.entities.add({ id: `${event.id}-track`, polyline: { positions: [Cartesian3.fromDegrees(event.lng - 0.8, event.lat - 2, 300), Cartesian3.fromDegrees(event.lng + 0.8, event.lat + 2, 300)], width: 1, material: system.withAlpha(0.2), arcType: ArcType.GEODESIC } });
      }
    }
    for (const event of liveEvents) {
      if (!layers.has(event.layerId)) continue;
      if (filter.types && !filter.types.includes(event.type)) continue;
      if (filter.region && !`${event.region} ${event.country}`.toLowerCase().includes(filter.region.toLowerCase())) continue;
      const day = event.date.slice(0, 10);
      if (day < time.start || day > time.end || day > time.current) continue;
      const chosen = event.id === selected;
      const color = chosen ? system : Color.fromCssColorString(phenomenonColor(event.type));
      source.entities.add({
        id: event.id,
        name: `${event.title} · ${event.sourceLabel} · LIVE`,
        properties: { eventId: event.id, source: event.source, sourceUrl: event.sourceUrl },
        position: Cartesian3.fromDegrees(event.lng, event.lat, 250),
        point: {
          pixelSize: chosen ? 12 : lod === "global" ? 6 : 8,
          color,
          outlineColor: chosen ? system : Color.WHITE.withAlpha(0.85),
          outlineWidth: chosen ? 3 : 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }
    ref.current?.scene.requestRender();
  }, [layers, filter, time, lod, opacity, selected, ready, liveEvents]);

  return <div className="absolute inset-0 earth-renderer" data-earth-engine="cesium">
    <div ref={container} className="absolute inset-0" />
    {!ready && !error && <div className="earth-status label-xs" role="status">LOADING EARTH IMAGERY</div>}
    {error && <div className="earth-status label-xs" role="status">{error}</div>}
    <div className="earth-attribution">{imageryLabel} · sample scientific overlays</div>
  </div>;
}
