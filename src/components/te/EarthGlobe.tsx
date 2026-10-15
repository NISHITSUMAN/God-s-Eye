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
  ImageryLayer,
  Ion,
  createWorldTerrainAsync,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { useApp, visibleEvents } from "@/lib/store";
import { eventOpacity } from "@/lib/earth-data";
import { phenomenonColor } from "@/lib/mock-data";

/**
 * Imagery is a basemap only. Scientific events/footprints remain clearly
 * labelled sample data until a real observations provider is connected.
 *
 * Optional provider config:
 *   VITE_CESIUM_ION_TOKEN=... (recommended)
 *   VITE_CESIUM_ION_IMAGERY_ASSET_ID=2 (optional override; verify asset/license)
 *   VITE_EARTH_IMAGERY_URL=https://.../{z}/{x}/{y}.png (optional XYZ source)
 *   VITE_EARTH_IMAGERY_ATTRIBUTION=...
 *   VITE_CESIUM_TERRAIN=true (optional, needs ion access)
 */
const FALLBACK_ATTRIBUTION = "OpenStreetMap contributors";
const XYZ_URL = import.meta.env.VITE_EARTH_IMAGERY_URL as string | undefined;
const XYZ_ATTRIBUTION = import.meta.env.VITE_EARTH_IMAGERY_ATTRIBUTION as string | undefined;
const ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
const ION_IMAGERY_ASSET_ID = Number(import.meta.env.VITE_CESIUM_ION_IMAGERY_ASSET_ID || 2);
const USE_ION_TERRAIN = String(import.meta.env.VITE_CESIUM_TERRAIN || "false").toLowerCase() === "true";

export default function EarthGlobe() {
  const container = useRef<HTMLDivElement>(null);
  const ref = useRef<Viewer | null>(null);
  const [viewerInstance, setViewerInstance] = useState<Viewer | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageryLabel, setImageryLabel] = useState("OpenStreetMap");
  const layers = useApp(s => s.layers);
  const filter = useApp(s => s.filter);
  const time = useApp(s => s.time);
  const lod = useApp(s => s.lod);
  const opacity = useApp(s => s.opacity);
  const selected = useApp(s => s.selectedId);
  const nonce = useApp(s => s.viewNonce);
  const ds = useRef<CustomDataSource | null>(null);

  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
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

    const loadImagery = async () => {
      try {
        if (XYZ_URL) {
          const provider = new UrlTemplateImageryProvider({
            url: XYZ_URL,
            credit: XYZ_ATTRIBUTION || FALLBACK_ATTRIBUTION,
            maximumLevel: 19,
          });
          if (!cancelled && !viewer.isDestroyed()) {
            viewer.imageryLayers.addImageryProvider(provider);
            setImageryLabel(XYZ_ATTRIBUTION || "Configured imagery provider");
            setReady(true);
            setError(null);
            return;
          }
        }
        if (token) {
          try {
            const provider = await (await import("cesium")).IonImageryProvider.fromAssetId(ION_IMAGERY_ASSET_ID);
            if (!cancelled && !viewer.isDestroyed()) {
              viewer.imageryLayers.addImageryProvider(provider);
              setImageryLabel("Cesium ion imagery");
              setReady(true);
              setError(null);
              return;
            }
          } catch (ionError) {
            console.warn("Cesium ion imagery unavailable; using public fallback.", ionError);
          }
        }
        // OSM standard raster tiles are a globally available fallback, not satellite imagery.
        const provider = new UrlTemplateImageryProvider({
          url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          credit: "© OpenStreetMap contributors",
          minimumLevel: 0,
          maximumLevel: 19,
        });
        if (!cancelled && !viewer.isDestroyed()) {
          viewer.imageryLayers.addImageryProvider(provider);
          setImageryLabel(XYZ_ATTRIBUTION || "© OpenStreetMap contributors");
          setReady(true);
          setError(null);
        }
      } catch (loadError) {
        console.error("Earth imagery failed to load.", loadError);
        if (!cancelled && !viewer.isDestroyed()) setError("Earth tiles could not load. Check your connection or imagery provider settings.");
      }
    };
    void loadImagery();

    if (USE_ION_TERRAIN && token) {
      void createWorldTerrainAsync().then(terrain => {
        if (!cancelled && !viewer.isDestroyed()) {
          viewer.terrainProvider = terrain;
          viewer.scene.globe.depthTestAgainstTerrain = true;
        }
      }).catch(terrainError => {
        console.warn("Optional terrain is unavailable; keeping ellipsoid terrain.", terrainError);
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
    ref.current?.scene.requestRender();
  }, [layers, filter, time, lod, opacity, selected, ready]);

  return <div className="absolute inset-0 earth-renderer" data-earth-engine="cesium">
    <div ref={container} className="absolute inset-0" />
    {!ready && <div className="earth-status label-xs" role="status">{error ?? "LOADING EARTH IMAGERY"}</div>}
    <div className="earth-attribution">{imageryLabel} · CesiumJS · sample overlays</div>
  </div>;
}
