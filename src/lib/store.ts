import { create } from "zustand";
import { EARTH_EVENTS, confidenceRank, lodForAltitude, severityBand, type EarthEventRecord, type EarthMode, type EvidenceClass, type LodBand, type SeverityBand } from "./earth-data";
import type { AOI, AnalysisResult } from "./analysis";
import type { Phenomenon } from "./mock-data";
import { fetchLiveEarthData, type LiveEarthEvent } from "./live-data";
import { searchNISARCoverage, type NISARCollection, type NISARGranule } from "./nasa-cmr";

export type Mode = "science" | "intelligence";
export interface View { lat: number; lng: number; altitude: number }
export interface TimeRange { start: string; end: string; current: string }
export interface EarthFilter {
  types: Phenomenon[] | null;
  region: string | null;
  significance: "all" | "high" | "moderate+";
  confidence: "all" | "high" | "moderate+";
  severity: "all" | SeverityBand;
  evidence: "all" | EvidenceClass;
}
export interface InvestigationContext {
  region: string | null;
  selectedId: string | null;
  types: Phenomenon[] | null;
  comparison: "before-after" | "historical" | null;
  lastAnalysisId: string | null;
}
export interface AIStep { label: string; status: "done" | "active" | "pending" | "error" }
export interface AIMessage { id: string; role: "user" | "system"; text: string; actions?: { label: string; run: string }[] | undefined }

export interface AppState {
  aoi: AOI | null;
  analyses: AnalysisResult[];
  liveEvents: LiveEarthEvent[];
  liveDataStatus: "idle" | "loading" | "ready" | "partial" | "error";
  liveDataUpdatedAt: string | null;
  liveDataError: string | null;
  refreshLiveData: () => Promise<void>;
  nisarCollections: NISARCollection[];
  nisarCollectionHits: number;
  nisarProductCollections: NISARCollection[];
  nisarGranules: NISARGranule[];
  nisarGranuleHits: number;
  nisarSelectedProductCodes: string[];
  nisarStatus: "idle" | "loading" | "ready" | "partial" | "error";
  nisarUpdatedAt: string | null;
  nisarError: string | null;
  refreshNISARData: (productCodes?: string[]) => Promise<void>;
  setAOI: (aoi: AOI | null) => void;
  addAnalysis: (result: AnalysisResult) => void;
  sidebarCollapsed: boolean;
  mode: Mode;
  earthMode: EarthMode;
  lod: LodBand;
  advanced: boolean;
  layers: Set<string>;
  opacity: Record<string, number>;
  selectedId: string | null;
  hoveredId: string | null;
  view: View;
  viewNonce: number;
  time: TimeRange;
  monthIndex: number;
  playing: boolean;
  playbackSpeed: 1 | 2 | 4;
  filter: EarthFilter;
  aiActive: boolean;
  aiMessages: AIMessage[];
  aiSteps: AIStep[] | null;
  aiTitle: string | null;
  onboarded: boolean;
  guideStep: number | null;
  investigation: InvestigationContext;
  setSidebar: (value: boolean) => void;
  setMode: (mode: Mode) => void;
  setEarthMode: (mode: EarthMode) => void;
  setAdvanced: (value: boolean) => void;
  toggleLayer: (id: string, on?: boolean) => void;
  setOpacity: (id: string, value: number) => void;
  select: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  flyTo: (view: Partial<View> & { lat: number; lng: number }) => void;
  syncView: (view: View) => void;
  setMonth: (month: number) => void;
  setCurrentDate: (date: string) => void;
  setTimeRange: (range: Pick<TimeRange, "start" | "end">) => void;
  setPlaying: (value: boolean) => void;
  setPlaybackSpeed: (value: 1 | 2 | 4) => void;
  setFilter: (filter: Partial<EarthFilter>) => void;
  resetFilter: () => void;
  setAIActive: (value: boolean) => void;
  pushMessage: (message: AIMessage) => void;
  setSteps: (title: string | null, steps: AIStep[] | null) => void;
  setOnboarded: (value: boolean) => void;
  setGuideStep: (step: number | null) => void;
  setInvestigation: (value: Partial<InvestigationContext>) => void;
}

export const DEFAULT_FILTER: EarthFilter = { types: null, region: null, significance: "all", confidence: "all", severity: "all", evidence: "all" };

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function createInitialTimeRange(): TimeRange {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setUTCFullYear(start.getUTCFullYear() - 2);
  return { start: dateKey(start), end: dateKey(today), current: dateKey(today) };
}

const INITIAL_TIME = createInitialTimeRange();
let latestNISARRequest = 0;
const DEFAULT_NISAR_PRODUCTS = ["GCOV", "GSLC", "GUNW", "SME2"];

export const useApp = create<AppState>((set) => ({
  aoi: null,
  analyses: [],
  liveEvents: [],
  liveDataStatus: "idle",
  liveDataUpdatedAt: null,
  liveDataError: null,
  refreshLiveData: async () => {
    if (useApp.getState().liveDataStatus === "loading") return;
    set({ liveDataStatus: "loading", liveDataError: null });
    try {
      const result = await fetchLiveEarthData();
      set((state) => {
        const failedUSGS = result.errors.some((error) => error.startsWith("USGS:"));
        const failedEONET = result.errors.some((error) => error.startsWith("NASA EONET:"));
        const retained = state.liveEvents.filter((event) =>
          (event.source === "USGS" && failedUSGS) ||
          (event.source === "NASA EONET" && failedEONET),
        );
        const combined = [...retained, ...result.events];
        const unique = [...new Map(combined.map((event) => [event.id, event])).values()];
        return {
          liveEvents: unique,
          liveDataStatus: result.errors.length ? "partial" : "ready",
          liveDataUpdatedAt: new Date().toISOString(),
          liveDataError: result.errors.length ? result.errors.join(" ") : null,
        };
      });
    } catch (error) {
      set((state) => ({
        liveDataStatus: state.liveEvents.length ? "partial" : "error",
        liveDataError: error instanceof Error ? error.message : "Live data could not be loaded.",
      }));
    }
  },
  nisarCollections: [],
  nisarCollectionHits: 0,
  nisarProductCollections: [],
  nisarGranules: [],
  nisarGranuleHits: 0,
  nisarSelectedProductCodes: DEFAULT_NISAR_PRODUCTS,
  nisarStatus: "idle",
  nisarUpdatedAt: null,
  nisarError: null,
  refreshNISARData: async (requestedProducts) => {
    const requestId = ++latestNISARRequest;
    const initial = useApp.getState();
    const productCodes = [...new Set((requestedProducts ?? initial.nisarSelectedProductCodes).map(code => code.toUpperCase()))]
      .filter(code => ["GCOV", "GSLC", "GUNW", "GOFF", "RSLC", "RIFG", "ROFF", "RUNW", "SME2"].includes(code));
    set({ nisarSelectedProductCodes: productCodes, nisarStatus: "loading", nisarError: null });

    if (!productCodes.length) {
      set({
        nisarGranules: [],
        nisarGranuleHits: 0,
        nisarStatus: "ready",
        nisarUpdatedAt: new Date().toISOString(),
        nisarError: null,
      });
      return;
    }

    const snapshot = useApp.getState();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayKey = dateKey(today);
    const endDate = snapshot.time.end > todayKey ? todayKey : snapshot.time.end;
    const startDate = snapshot.time.start > endDate ? endDate : snapshot.time.start;
    const aoiBounds = snapshot.aoi?.bounds;
    const bounds = aoiBounds && aoiBounds.length === 4 && aoiBounds.every(Number.isFinite)
      ? { west: aoiBounds[0]!, south: aoiBounds[1]!, east: aoiBounds[2]!, north: aoiBounds[3]! }
      : { west: 68, south: 6, east: 98, north: 38 };
    try {
      const result = await searchNISARCoverage({ bounds, startDate, endDate, productCodes });
      if (requestId !== latestNISARRequest) return;
      set({
        nisarCollections: result.collections,
        nisarCollectionHits: result.collectionHits,
        nisarProductCollections: result.productCollections,
        nisarGranules: result.granules,
        nisarGranuleHits: result.granuleHits,
        nisarStatus: result.warnings.length ? "partial" : "ready",
        nisarUpdatedAt: new Date().toISOString(),
        nisarError: result.warnings.length ? result.warnings.join(" ") : null,
      });
    } catch (error) {
      if (requestId !== latestNISARRequest) return;
      set((state) => ({
        nisarStatus: state.nisarGranules.length ? "partial" : "error",
        nisarError: error instanceof Error ? error.message : "Real NISAR catalog search failed.",
      }));
    }
  },
  setAOI: (aoi) => set({ aoi }),
  addAnalysis: (result) => set(state => ({ analyses: [...state.analyses,result], investigation: {...state.investigation,lastAnalysisId:result.id} })),
  sidebarCollapsed: true,
  mode: "intelligence",
  earthMode: "3d",
  lod: "global",
  advanced: false,
  layers: new Set(["nisar-footprints", "nisar-tracks", "nisar-coverage", "prod-GCOV", "prod-GSLC", "prod-GUNW", "prod-SME2", "fire", "flood", "landslide", "subsidence", "volcano", "earthquake", "glacier", "forest", "agriculture", "soil", "coastal", "urban", "live-usgs", "live-eonet"]),
  opacity: {},
  selectedId: null,
  hoveredId: null,
  view: { lat: 18, lng: 70, altitude: 2.4 },
  viewNonce: 0,
  time: INITIAL_TIME,
  monthIndex: 9,
  playing: false,
  playbackSpeed: 1,
  filter: DEFAULT_FILTER,
  aiActive: false,
  aiMessages: [],
  aiSteps: null,
  aiTitle: null,
  onboarded: true,
  guideStep: 0,
  investigation: { region: null, selectedId: null, types: null, comparison: null, lastAnalysisId: null },
  setSidebar: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setMode: (mode) => set({ mode }),
  setEarthMode: (earthMode) => set({ earthMode }),
  setAdvanced: (advanced) => set({ advanced }),
  toggleLayer: (id, on) => set((state) => {
    const layers = new Set(state.layers);
    const enabled = on ?? !layers.has(id);
    if (enabled) layers.add(id); else layers.delete(id);
    return { layers };
  }),
  setOpacity: (id, value) => set((state) => ({ opacity: { ...state.opacity, [id]: value } })),
  select: (id) => set((state) => {
    if (!id) return { selectedId: null, investigation: { ...state.investigation, selectedId: null } };
    const event = EARTH_EVENTS.find((item) => item.id === id) ?? state.liveEvents.find((item) => item.id === id);
    if (!event) {
      const granule = state.nisarGranules.find((item) => item.id === id);
      if (!granule) return { selectedId: id, investigation: { ...state.investigation, selectedId: id } };
      const bounds = granule.bounds;
      const footprint = granule.footprint ?? [];
      const hasFootprint = footprint.length >= 3;
      const lat = bounds
        ? (bounds.south + bounds.north) / 2
        : hasFootprint
          ? footprint.reduce((sum, point) => sum + point[1], 0) / footprint.length
          : state.view.lat;
      const lng = bounds
        ? (bounds.west + bounds.east) / 2
        : hasFootprint
          ? footprint.reduce((sum, point) => sum + point[0], 0) / footprint.length
          : state.view.lng;
      const eventDay = (granule.startDate || state.time.current).slice(0, 10);
      const safeDay = eventDay > dateKey(new Date()) ? dateKey(new Date()) : eventDay;
      const start = safeDay < state.time.start ? safeDay : state.time.start;
      const end = safeDay > state.time.end ? safeDay : state.time.end;
      return {
        selectedId: id,
        view: { lat: Number.isFinite(lat) ? lat : state.view.lat, lng: Number.isFinite(lng) ? lng : state.view.lng, altitude: 0.12 },
        lod: lodForAltitude(0.12),
        viewNonce: state.viewNonce + 1,
        monthIndex: new Date(safeDay).getUTCMonth(),
        time: { ...state.time, start, end, current: safeDay },
        investigation: { ...state.investigation, selectedId: id, region: "NISAR acquisition coverage", types: null },
      };
    }
    const eventDay = event.date.slice(0, 10);
    const monthIndex = new Date(eventDay).getUTCMonth();
    return {
      selectedId: id,
      view: { lat: event.lat, lng: event.lng, altitude: 0.015 },
      lod: lodForAltitude(0.015),
      viewNonce: state.viewNonce + 1,
      monthIndex,
      time: {
        ...state.time,
        start: eventDay < state.time.start ? eventDay : state.time.start,
        end: eventDay > state.time.end ? eventDay : state.time.end,
        current: eventDay,
      },
      investigation: { ...state.investigation, selectedId: id, region: event.region || event.country, types: [event.type] },
    };
  }),
  setHovered: (hoveredId) => set({ hoveredId }),
  flyTo: (value) => set((state) => {
    const view = { altitude: 1.2, ...value };
    return { view, lod: lodForAltitude(view.altitude), viewNonce: state.viewNonce + 1 };
  }),
  syncView: (view) => set({ view, lod: lodForAltitude(view.altitude) }),
  setMonth: (monthIndex) => set((state) => {
    const safeMonth = Math.min(11, Math.max(0, monthIndex));
    const year = Number(state.time.current.slice(0, 4));
    const day = Number(state.time.current.slice(8, 10));
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const maxMonth = year === today.getUTCFullYear() ? today.getUTCMonth() : 11;
    const month = Math.min(safeMonth, maxMonth);
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const requested = `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
    const end = state.time.end > dateKey(today) ? dateKey(today) : state.time.end;
    const current = requested < state.time.start ? state.time.start : requested > end ? end : requested;
    return { monthIndex: new Date(current).getUTCMonth(), time: { ...state.time, end, current } };
  }),
  setCurrentDate: (current) => set((state) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const end = state.time.end > dateKey(today) ? dateKey(today) : state.time.end;
    const safeCurrent = current < state.time.start ? state.time.start : current > end ? end : current;
    return { time: { ...state.time, end, current: safeCurrent }, monthIndex: new Date(safeCurrent).getUTCMonth() };
  }),
  setTimeRange: (range) => set((state) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayKey = dateKey(today);
    const end = range.end > todayKey ? todayKey : range.end;
    const start = range.start > end ? end : range.start;
    const current = state.time.current < start ? start : state.time.current > end ? end : state.time.current;
    return { time: { ...state.time, start, end, current }, monthIndex: new Date(current).getUTCMonth() };
  }),
  setPlaying: (playing) => set({ playing }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setFilter: (value) => set((state) => {
    const filter = { ...state.filter, ...value };
    return { filter, investigation: { ...state.investigation, region: filter.region, types: filter.types } };
  }),
  resetFilter: () => set((state) => ({ filter: DEFAULT_FILTER, investigation: { ...state.investigation, region: null, types: null } })),
  setAIActive: (aiActive) => set({ aiActive }),
  pushMessage: (message) => set((state) => ({ aiMessages: [...state.aiMessages, message] })),
  setSteps: (aiTitle, aiSteps) => set({ aiTitle, aiSteps }),
  setOnboarded: (onboarded) => set({ onboarded }),
  setGuideStep: (guideStep) => set({ guideStep }),
  setInvestigation: (value) => set((state) => ({ investigation: { ...state.investigation, ...value } })),
}));

export function visibleEvents(state: Pick<AppState, "layers" | "filter" | "time" | "lod"> & Partial<Pick<AppState, "monthIndex">>, all: readonly EarthEventRecord[] = EARTH_EVENTS) {
  const current = new Date(state.time.current).getTime();
  return all.filter((event) => {
    if (!state.layers.has(event.type)) return false;
    if (state.filter.types && !state.filter.types.includes(event.type)) return false;
    if (state.filter.region && !`${event.region} ${event.country}`.toLowerCase().includes(state.filter.region.toLowerCase())) return false;
    if (new Date(event.validFrom).getTime() > current) return false;
    const band = severityBand(event.severity);
    if (state.filter.severity !== "all" && band !== state.filter.severity) return false;
    if (state.filter.significance === "high" && !(event.severity >= 0.7 && event.confidence === "High")) return false;
    if (state.filter.significance === "moderate+" && event.severity < 0.45) return false;
    if (state.filter.confidence === "high" && event.confidence !== "High") return false;
    if (state.filter.confidence === "moderate+" && confidenceRank[event.confidence] < 2) return false;
    if (state.filter.evidence !== "all" && event.evidenceClass !== state.filter.evidence) return false;
    if (event.date < state.time.start || event.date > state.time.end) return false;
    return true;
  });
}