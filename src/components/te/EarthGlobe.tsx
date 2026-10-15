import { useEffect, useRef, useState } from "react";
import { Viewer, Cartesian2, Cartesian3, Color, CustomDataSource, EllipsoidTerrainProvider, Ellipsoid, Math as CesiumMath, PolygonHierarchy, ScreenSpaceEventHandler, ScreenSpaceEventType, TileMapServiceImageryProvider, ImageryLayer, ArcType, JulianDate } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { useApp, visibleEvents } from "@/lib/store";
import { eventOpacity, sampleDataProvider } from "@/lib/earth-data";
import { phenomenonColor } from "@/lib/mock-data";

export default function EarthGlobe() {
  const container = useRef<HTMLDivElement>(null);
  const ref = useRef<Viewer | null>(null);
  const [viewerInstance, setViewerInstance] = useState<Viewer | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    const viewer = new Viewer(container.current, { baseLayer: false, terrainProvider: new EllipsoidTerrainProvider(), animation:false, timeline:false, baseLayerPicker:false, geocoder:false, homeButton:false, sceneModePicker:false, navigationHelpButton:false, fullscreenButton:false, infoBox:false, selectionIndicator:false });
    ref.current = viewer;
    setViewerInstance(viewer);
    return () => { ref.current = null; if (!viewer.isDestroyed()) viewer.destroy(); };
  }, []);

  useEffect(() => {
    const viewer = viewerInstance;
    if (!viewer) return;
    const source = new CustomDataSource("Third Eye sample observations");
    ds.current = source;
    viewer.dataSources.add(source);
    viewer.scene.backgroundColor = Color.fromCssColorString(getComputedStyle(document.documentElement).getPropertyValue("--earth-space").trim());
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
    if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
    if (viewer.scene.sun) viewer.scene.sun.show = false;
    if (viewer.scene.moon) viewer.scene.moon.show = false;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1000;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 35000000;
    viewer.camera.percentageChanged = 0.02;
    const view = useApp.getState().view;
    viewer.camera.setView({ destination: Cartesian3.fromDegrees(view.lng, view.lat, view.altitude * Ellipsoid.WGS84.maximumRadius) });
    TileMapServiceImageryProvider.fromUrl("/cesium/Assets/Textures/NaturalEarthII").then(provider => {
      if (viewer.isDestroyed()) return;
      viewer.imageryLayers.add(new ImageryLayer(provider));
      setReady(true);
    }).catch(() => setError("Earth imagery could not be retrieved."));
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
      handler.destroy(); removeCamera(); removeTick();
      if (!viewer.isDestroyed()) { viewer.scene.canvas.removeEventListener("pointerdown", markInteraction); viewer.scene.canvas.removeEventListener("wheel", markInteraction); viewer.dataSources.remove(source, true); }
      ds.current = null;
    };
  }, [viewerInstance]);

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
    const system = Color.fromCssColorString(css.getPropertyValue("--earth-selection").trim());
    source.clustering.enabled = lod === "global";
    source.clustering.pixelRange = 32;
    source.clustering.minimumClusterSize = 3;
    const events = visibleEvents({ layers, filter, time, lod });
    for (const event of events) {
      const chosen = event.id === selected;
      const alpha = eventOpacity(event) * ((opacity[event.type] ?? 100) / 100) * (selected && !chosen ? 0.65 : 1);
      const color = chosen ? system : Color.fromCssColorString(phenomenonColor(event.type)).withAlpha(alpha);
      source.entities.add({ id: event.id, name: `${event.title} · ${event.region} · SAMPLE`, properties: { eventId: event.id }, position: Cartesian3.fromDegrees(event.lng, event.lat, 200), point: { pixelSize: chosen ? 11 : lod === "global" ? 5 : lod === "regional" ? 7 : 9, color, outlineColor: chosen ? system : color.withAlpha(0.5), outlineWidth: chosen ? 3 : 1, disableDepthTestDistance: Number.POSITIVE_INFINITY } });
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
    {!ready && <div className="earth-status label-xs">{error ?? "LOADING EARTH IMAGERY"}</div>}
    <div className="earth-attribution">Natural Earth II · CesiumJS · sample overlays</div>
  </div>;
}
