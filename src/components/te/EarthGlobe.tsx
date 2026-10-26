import { useEffect, useRef, useState } from "react";
import {
  Viewer,
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  GeoJsonDataSource,
  EllipsoidTerrainProvider,
  Ellipsoid,
  Math as CesiumMath,
  PolygonHierarchy,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  ArcType,
  JulianDate,
  LabelStyle,
  UrlTemplateImageryProvider,
  TileMapServiceImageryProvider,
  ArcGisMapServerImageryProvider,
  Ion,
  IonImageryProvider,
  createWorldTerrainAsync,
} from "cesium";
import type { ImageryLayer, ImageryProvider } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { useApp, visibleEvents } from "@/lib/store";
import { eventOpacity } from "@/lib/earth-data";
import { phenomenonColor } from "@/lib/mock-data";

const ION_TOKEN = import.meta.env["VITE_CESIUM_ION_TOKEN"] as string | undefined;
const ION_IMAGERY_ASSET_ID = Number(import.meta.env["VITE_CESIUM_ION_IMAGERY_ASSET_ID"] || 2);
const CUSTOM_IMAGERY_URL = import.meta.env["VITE_EARTH_IMAGERY_URL"] as string | undefined;
const CUSTOM_IMAGERY_ATTRIBUTION = import.meta.env["VITE_EARTH_IMAGERY_ATTRIBUTION"] as string | undefined;
const USE_ION_TERRAIN = String(import.meta.env["VITE_CESIUM_TERRAIN"] || "false").toLowerCase() === "true";

async function esriWorldImagery(): Promise<ImageryProvider> {
  // Use Cesium's native ArcGIS provider rather than constructing REST tile URLs by hand.
  return ArcGisMapServerImageryProvider.fromUrl(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
    { enablePickFeatures: false },
  );
}

function openStreetMapImagery(): ImageryProvider {
  return new UrlTemplateImageryProvider({
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    credit: "© OpenStreetMap contributors",
    minimumLevel: 0,
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
  const retryImageryRef = useRef<(() => void) | null>(null);
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
  const nisarGranules = useApp(s => s.nisarGranules);
  const nonce = useApp(s => s.viewNonce);
  const ds = useRef<CustomDataSource | null>(null);

  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    let fallbackBusy = false;
    let activeProvider: ImageryProvider | undefined;
    let activeLayer: ReturnType<Viewer["imageryLayers"]["addImageryProvider"]> | undefined;
    setReady(false);
    setError(null);
    const token = ION_TOKEN?.trim();
    if (token) Ion.defaultAccessToken = token;

    let boundaryDataSource: GeoJsonDataSource | null = null;
    let viewer: Viewer;
    try {
      viewer = new Viewer(container.current, {
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
        // Normal rendering plus resize observation avoids stale first frames on mobile WebGL.
        requestRenderMode: false,
        maximumRenderTimeChange: Infinity,
      });
      viewer.resolutionScale = window.innerWidth < 760 ? 0.8 : 1;
    } catch (initializationError) {
      console.error("Cesium could not initialize WebGL.", initializationError);
      setError("The 3D Earth could not start in this browser. Try the 2D map or another browser with WebGL enabled.");
      return;
    }
    ref.current = viewer;

    const referenceLayers: Array<{ layer: ImageryLayer; minHeight: number; maxHeight: number }> = [];
    let referenceLayersPromise: Promise<void> | null = null;

    const updateReferenceLayers = () => {
      if (cancelled || viewer.isDestroyed()) return;
      const height = viewer.camera.positionCartographic.height;
      for (const reference of referenceLayers) {
        const alpha = Math.max(0, Math.min(1, (reference.maxHeight - height) / (reference.maxHeight - reference.minHeight)));
        reference.layer.show = alpha > 0.01;
        reference.layer.alpha = alpha;
      }
      if (referenceLayers.length) viewer.scene.requestRender();
    };

    // Transparent reference tiles fade in while zooming, keeping the 3D satellite globe
    // as the base view instead of switching to a separate 2D map.
    const installReferenceLayers = () => {
      if (referenceLayersPromise) return referenceLayersPromise;
      referenceLayersPromise = (async () => {
        const services = [
          {
            url: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer",
            minHeight: 1_000_000,
            maxHeight: 10_000_000,
          },
          {
            url: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer",
            minHeight: 250_000,
            maxHeight: 2_500_000,
          },
        ];
        const results = await Promise.allSettled(services.map((item) =>
          ArcGisMapServerImageryProvider.fromUrl(item.url, { enablePickFeatures: false }),
        ));
        if (cancelled || viewer.isDestroyed()) return;
        results.forEach((result, index) => {
          if (result.status !== "fulfilled") {
            console.warn("A transparent map-reference layer could not load.", result.reason);
            return;
          }
          const service = services[index];
          if (!service) return;
          const layer = viewer.imageryLayers.addImageryProvider(result.value);
          layer.alpha = 0;
          layer.show = false;
          referenceLayers.push({ layer, minHeight: service.minHeight, maxHeight: service.maxHeight });
        });
        updateReferenceLayers();
      })().catch((error) => {
        console.warn("Optional zoom-dependent map labels could not load.", error);
      });
      return referenceLayersPromise;
    };

    const removeActiveLayer = () => {
      if (activeLayer) viewer.imageryLayers.remove(activeLayer, true);
      activeLayer = undefined;
      activeProvider = undefined;
    };

    const installProvider = (
      provider: ImageryProvider,
      label: string,
      nextFallback: (() => void | Promise<void>) | null,
      notice: string | null = null,
    ) => {
      if (cancelled || viewer.isDestroyed()) return;
      removeActiveLayer();
      activeLayer = viewer.imageryLayers.addImageryProvider(provider);
      activeProvider = provider;
      setImageryLabel(label);
      setReady(true);
      setError(notice);
      viewer.scene.requestRender();
      void installReferenceLayers();
      provider.errorEvent.addEventListener((tileError) => {
        if (cancelled || viewer.isDestroyed() || activeProvider !== provider || fallbackBusy) return;
        if (tileError.timesRetried < 2) return;
        if (!nextFallback) {
          setError("Earth tiles are failing to load. Check your connection, retry, or switch to the 2D map.");
          return;
        }
        fallbackBusy = true;
        void Promise.resolve(nextFallback()).finally(() => { fallbackBusy = false; });
      });
    };

    const installNaturalEarthFallback = async () => {
      if (cancelled || viewer.isDestroyed()) return;
      try {
        const provider = await TileMapServiceImageryProvider.fromUrl("/cesium/Assets/Textures/NaturalEarthII");
        installProvider(provider, "Natural Earth II fallback", null, "High-detail imagery could not load. Showing a low-resolution fallback.");
      } catch (fallbackError) {
        console.error("Bundled Earth fallback could not be loaded.", fallbackError);
        setReady(false);
        setError("No Earth imagery source could load. Check your connection, retry, or switch to the 2D map.");
      }
    };

    const installOSMFallback = (notice: string) => {
      installProvider(
        openStreetMapImagery(),
        "OpenStreetMap",
        () => installNaturalEarthFallback(),
        notice,
      );
    };

    const installEsriFallback = async (notice?: string) => {
      if (cancelled || viewer.isDestroyed()) return;
      try {
        const provider = await esriWorldImagery();
        installProvider(
          provider,
          "Esri World Imagery",
          () => installOSMFallback("Satellite tiles are unavailable on this connection. Switched to OpenStreetMap."),
          notice ?? null,
        );
      } catch (providerError) {
        console.warn("Esri imagery could not initialize; trying OpenStreetMap.", providerError);
        installOSMFallback("Satellite imagery could not initialize. Showing OpenStreetMap instead.");
      }
    };

    const installConfigured = (provider: ImageryProvider, label: string) => {
      installProvider(
        provider,
        label,
        () => installEsriFallback("The configured imagery source failed. Switched to Esri World Imagery."),
      );
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
          console.warn("Cesium ion imagery unavailable; trying public imagery.", ionError);
        }
      }
      await installEsriFallback();
    };

    const retry = () => {
      if (cancelled || viewer.isDestroyed()) return;
      fallbackBusy = false;
      removeActiveLayer();
      setReady(false);
      setError(null);
      setImageryLabel("Retrying imagery");
      void loadImagery();
    };
    retryImageryRef.current = retry;
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
    const boundaryColor = Color.fromCssColorString("#FF9933");
    void GeoJsonDataSource.load("/data/jammu-kashmir-ladakh.geojson", {
      clampToGround: true,
      stroke: boundaryColor,
      strokeWidth: 6,
      fill: boundaryColor.withAlpha(0.22),
    }).then(async (boundary) => {
      if (cancelled || viewer.isDestroyed()) return;
      boundaryDataSource = boundary;
      for (const entity of boundary.entities.values) {
        const name = entity.properties?.["name"]?.getValue(JulianDate.now());
        if (typeof name === "string") entity.name = `${name} · India official boundary representation`;
      }
      const boundaryLabel = (id: string, text: string, longitude: number, latitude: number) => boundary.entities.add({
        id,
        name: text,
        position: Cartesian3.fromDegrees(longitude, latitude, 50000),
        label: {
          text,
          font: "bold 15px sans-serif",
          fillColor: Color.fromCssColorString("#FFF2E2"),
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          showBackground: true,
          backgroundColor: Color.fromCssColorString("#05121B").withAlpha(0.88),
          pixelOffset: new Cartesian2(0, -12),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      boundaryLabel("india-jammu-kashmir-label", "JAMMU & KASHMIR · INDIA", 74.95, 34.0);
      boundaryLabel("india-ladakh-label", "LADAKH · INDIA", 78.0, 34.6);
      await viewer.dataSources.add(boundary);
      viewer.scene.requestRender();
    }).catch((boundaryError) => {
      console.error("India-aligned Jammu and Kashmir / Ladakh boundary overlay could not load.", boundaryError);
    });
    viewer.scene.backgroundColor = Color.fromCssColorString(getComputedStyle(document.documentElement).getPropertyValue("--earth-space").trim() || "#050A0F");
    viewer.scene.globe.baseColor = Color.fromCssColorString("#182733");
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
    if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
    if (viewer.scene.sun) viewer.scene.sun.show = false;
    if (viewer.scene.moon) viewer.scene.moon.show = false;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 80;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 35000000;
    viewer.camera.percentageChanged = 0.01;
    const removeReferenceCameraChange = viewer.camera.changed.addEventListener(updateReferenceLayers);
    const view = useApp.getState().view;
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(
        view.lng,
        view.lat,
        view.altitude * Ellipsoid.WGS84.maximumRadius,
      ),
      // Cesium otherwise keeps the viewer's previous world-space orientation. At lon 70°,
      // lat 18° that can leave the camera looking past Earth into empty space on first load.
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-90),
        roll: 0,
      },
    });
    viewer.scene.requestRender();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
      if (!viewer.isDestroyed()) {
        viewer.resize();
        viewer.scene.requestRender();
      }
    }) : null;
    if (resizeObserver && container.current) resizeObserver.observe(container.current);

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
      resizeObserver?.disconnect();
      retryImageryRef.current = null;
      handler.destroy();
      removeCamera();
      removeReferenceCameraChange();
      removeTick();
      if (!viewer.isDestroyed()) {
        viewer.scene.canvas.removeEventListener("pointerdown", markInteraction);
        viewer.scene.canvas.removeEventListener("wheel", markInteraction);
        viewer.dataSources.remove(source, true);
        if (boundaryDataSource) viewer.dataSources.remove(boundaryDataSource, true);
        for (const reference of referenceLayers) viewer.imageryLayers.remove(reference.layer, true);
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
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        view.lng,
        view.lat,
        view.altitude * Ellipsoid.WGS84.maximumRadius,
      ),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-90),
        roll: 0,
      },
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1.6,
    });
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
    for (const granule of nisarGranules) {
      if (!layers.has("nisar-coverage") || !layers.has(`prod-${granule.productCode}`) || !granule.bounds) continue;
      const day = (granule.startDate || "").slice(0, 10);
      if (day && (day < time.start || day > time.end || day > time.current)) continue;
      const footprint = granule.footprint && granule.footprint.length >= 3
        ? [...granule.footprint, granule.footprint[0]!]
        : [
            [granule.bounds.west, granule.bounds.south] as [number, number],
            [granule.bounds.east, granule.bounds.south] as [number, number],
            [granule.bounds.east, granule.bounds.north] as [number, number],
            [granule.bounds.west, granule.bounds.north] as [number, number],
            [granule.bounds.west, granule.bounds.south] as [number, number],
          ];
      const positions = footprint.map(point => Cartesian3.fromDegrees(point[0], point[1], 350));
      const hasSourceFootprint = Boolean(granule.footprint && granule.footprint.length >= 3);
      const chosen = granule.id === selected;
      const color = chosen ? system : Color.fromCssColorString("#2EC4FF");
      source.entities.add({
        id: granule.id,
        name: `${granule.productCode} · ${day || "date unavailable"} · ${hasSourceFootprint ? "SOURCE NISAR FOOTPRINT" : "APPROXIMATE CMR BOUNDS"}`,
        properties: { eventId: granule.id, source: "NASA CMR", sourceUrl: granule.earthdataSearchUrl, browseUrl: granule.browseUrl },
        polygon: {
          hierarchy: new PolygonHierarchy(footprint.slice(0, -1).map(point => Cartesian3.fromDegrees(point[0], point[1]))),
          material: color.withAlpha(chosen ? 0.2 : hasSourceFootprint ? 0.07 : 0.025),
          height: 300,
          outline: false,
        },
        polyline: {
          positions,
          width: chosen ? 3 : hasSourceFootprint ? 1.6 : 1.1,
          material: color.withAlpha(chosen ? 0.98 : hasSourceFootprint ? 0.95 : 0.58),
          arcType: ArcType.GEODESIC,
        },
      });
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
  }, [layers, filter, time, lod, opacity, selected, ready, liveEvents, nisarGranules]);

  return <div className="absolute inset-0 earth-renderer" data-earth-engine="cesium">
    <div ref={container} className="absolute inset-0" />
    {!ready && !error && <div className="earth-status label-xs" role="status">CONNECTING TO EARTH IMAGERY…</div>}
    {error && <div className="earth-status earth-status-action" role="status">
      <p>{error}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button type="button" className="rounded border border-primary/50 px-3 py-1.5 text-[11px] text-primary hover:bg-primary/10" onClick={() => retryImageryRef.current ? retryImageryRef.current() : window.location.reload()}>RETRY IMAGERY</button>
        <button type="button" className="rounded border border-border px-3 py-1.5 text-[11px] hover:bg-elevated" onClick={() => useApp.getState().setEarthMode("2d")}>OPEN 2D MAP</button>
      </div>
    </div>}
    <div className="earth-attribution">{imageryLabel} · NASA CMR / ASF footprints · India-aligned Kashmir boundary · sample candidates labelled separately</div>
  </div>;
}
