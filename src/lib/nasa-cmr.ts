const CMR_BASE = "https://cmr.earthdata.nasa.gov/search";
const CMR_TIMEOUT_MS = 15000;

export interface CMRBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface NISARCollection {
  conceptId: string;
  shortName: string;
  title: string;
  version: string;
  abstract: string;
  processingLevel: string;
  doi: string | null;
  startDate: string | null;
  endDate: string | null;
  revisionDate: string | null;
  metadataUrl: string;
  earthdataSearchUrl: string;
}

export type NISARPosition = [number, number];

export interface NISARGranule {
  id: string;
  conceptId: string;
  granuleId: string;
  collectionConceptId: string;
  collectionShortName: string;
  productCode: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  producer: string;
  bounds: CMRBounds | null;
  footprint: NISARPosition[] | null;
  browseUrl: string | null;
  dataUrl: string | null;
  metadataUrl: string;
  earthdataSearchUrl: string;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function granuleSpatial(umm: Record<string, unknown>): { bounds: CMRBounds | null; footprint: NISARPosition[] | null } {
  const spatial = recordOf(umm.SpatialExtent);
  const horizontal = recordOf(spatial?.HorizontalSpatialDomain);
  const geometry = recordOf(horizontal?.Geometry);
  const rectangles = Array.isArray(geometry?.BoundingRectangles)
    ? geometry.BoundingRectangles
    : geometry?.BoundingRectangle ? [geometry.BoundingRectangle] : [];
  for (const candidate of rectangles) {
    const item = recordOf(candidate);
    if (!item) continue;
    const west = finiteNumber(item.WestBoundingCoordinate);
    const south = finiteNumber(item.SouthBoundingCoordinate);
    const east = finiteNumber(item.EastBoundingCoordinate);
    const north = finiteNumber(item.NorthBoundingCoordinate);
    if (west !== null && south !== null && east !== null && north !== null &&
        west >= -180 && east <= 180 && south >= -90 && north <= 90 && west < east && south < north) {
      const bounds = { west, south, east, north };
      return { bounds, footprint: null };
    }
  }

  const polygons = Array.isArray(geometry?.GPolygons) ? geometry.GPolygons : [];
  for (const polygonCandidate of polygons) {
    const polygon = recordOf(polygonCandidate);
    const boundary = recordOf(polygon?.Boundary);
    const points = Array.isArray(boundary?.Points) ? boundary.Points : [];
    const footprint = points.flatMap((value): NISARPosition[] => {
      const point = recordOf(value);
      const lng = finiteNumber(point?.Longitude);
      const lat = finiteNumber(point?.Latitude);
      return lng !== null && lat !== null && Math.abs(lng) <= 180 && Math.abs(lat) <= 90
        ? [[lng, lat]]
        : [];
    });
    if (footprint.length >= 3) {
      const longitudes = footprint.map(point => point[0]);
      const latitudes = footprint.map(point => point[1]);
      const west = Math.min(...longitudes);
      const east = Math.max(...longitudes);
      const south = Math.min(...latitudes);
      const north = Math.max(...latitudes);
      if (west < east && south < north) return { bounds: { west, south, east, north }, footprint };
    }
  }
  return { bounds: null, footprint: null };
}

function safeCMRRelatedUrl(value: unknown): string | null {
  const candidate = textValue(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function granuleRelatedUrls(umm: Record<string, unknown>) {
  const related = Array.isArray(umm.RelatedUrls) ? umm.RelatedUrls : [];
  let browseUrl: string | null = null;
  let dataUrl: string | null = null;
  for (const candidate of related) {
    const item = recordOf(candidate);
    if (!item) continue;
    const url = safeCMRRelatedUrl(item.URL);
    if (!url) continue;
    const type = textValue(item.Type).toUpperCase();
    const contentType = textValue(item.URLContentType).toLowerCase();
    const mimeType = textValue(item.MimeType).toLowerCase();
    if (!browseUrl && (
      type.includes("VISUALIZATION") ||
      contentType.includes("visualization") ||
      mimeType.startsWith("image/")
    )) browseUrl = url;
    if (!dataUrl && (
      type.includes("GET DATA") ||
      type.includes("DIRECT ACCESS") ||
      contentType.includes("distribution")
    )) dataUrl = url;
  }
  return { browseUrl, dataUrl };
}

interface CMRItem {
  meta?: Record<string, unknown>;
  umm?: Record<string, unknown>;
}

interface CMRResponse {
  hits?: number;
  items?: CMRItem[];
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function safePlainText(value: unknown): string {
  return textValue(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRange(umm: Record<string, unknown>): { start: string | null; end: string | null } {
  const extents = Array.isArray(umm.TemporalExtents) ? umm.TemporalExtents : [];
  for (const extent of extents) {
    if (!extent || typeof extent !== "object") continue;
    const record = extent as Record<string, unknown>;
    const range = record.RangeDateTime && typeof record.RangeDateTime === "object"
      ? record.RangeDateTime as Record<string, unknown>
      : null;
    if (range) {
      return {
        start: textValue(range.BeginningDateTime) || null,
        end: textValue(range.EndingDateTime) || null,
      };
    }
    const single = record.SingleDateTime;
    if (typeof single === "string") return { start: single, end: single };
  }
  return { start: null, end: null };
}

async function fetchCMR<T>(url: URL): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CMR_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/vnd.nasa.cmr.umm_results+json, application/json" },
    });
    if (!response.ok) throw new Error(`NASA CMR returned HTTP ${response.status}.`);
    return await response.json() as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("NASA CMR search timed out. Try again.");
    }
    if (error instanceof TypeError) {
      throw new Error("NASA CMR could not be reached. Check your network or browser access to Earthdata.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Search public NASA CMR metadata for NISAR collections with granules.
 * This discovers catalog metadata only; it does not download or process science rasters.
 */
export async function searchNISARCollections(pageSize = 100): Promise<{ collections: NISARCollection[]; hits: number }> {
  const url = new URL(`${CMR_BASE}/collections.umm_json`);
  url.searchParams.set("keyword", "NISAR");
  url.searchParams.set("has_granules", "true");
  url.searchParams.set("page_size", String(Math.max(1, Math.min(100, Math.floor(pageSize)))));
  url.searchParams.append("sort_key[]", "-revision_date");

  const data = await fetchCMR<CMRResponse>(url);
  if (!Array.isArray(data.items)) throw new Error("NASA CMR returned an unexpected collection response.");

  const collections: NISARCollection[] = data.items.flatMap((item) => {
    const meta = item.meta;
    const umm = item.umm;
    if (!meta || !umm) return [];
    const conceptId = textValue(meta["concept-id"] ?? meta.concept_id);
    const shortName = textValue(umm.ShortName);
    const title = textValue(umm.EntryTitle);
    if (!conceptId || !shortName || !title || !/NISAR/i.test(shortName + " " + title)) return [];
    const dates = parseRange(umm);
    const doiRecord = umm.DOI && typeof umm.DOI === "object" ? umm.DOI as Record<string, unknown> : null;
    const doi = textValue(doiRecord?.DOI) || textValue(doiRecord?.doi) || null;
    const levelRecord = umm.ProcessingLevel && typeof umm.ProcessingLevel === "object"
      ? umm.ProcessingLevel as Record<string, unknown>
      : null;
    const processingLevel = textValue(levelRecord?.Id) || textValue(levelRecord?.ShortName) || textValue(levelRecord?.Description);
    return [{
      conceptId,
      shortName,
      title,
      version: textValue(umm.Version),
      abstract: safePlainText(umm.Abstract),
      processingLevel,
      doi,
      startDate: dates.start,
      endDate: dates.end,
      revisionDate: textValue(meta["revision-date"]) || null,
      metadataUrl: `https://cmr.earthdata.nasa.gov/search/concepts/${encodeURIComponent(conceptId)}`,
      earthdataSearchUrl: `https://search.earthdata.nasa.gov/search?q=${encodeURIComponent(shortName)}`,
    }];
  });

  collections.sort((a, b) => {
    const score = (item: NISARCollection) =>
      (/NISAR_L[123]/i.test(item.shortName) ? 10 : 0) +
      (/PROVISIONAL/i.test(item.shortName) ? 2 : 0) +
      (/GCOV|GSLC|GUNW|GOFF|RSLC|RIFG|ROFF|RUNW|SME2/i.test(item.shortName) ? 5 : 0);
    return score(b) - score(a) || a.title.localeCompare(b.title);
  });
  return {
    collections,
    hits: typeof data.hits === "number" && Number.isFinite(data.hits) ? data.hits : collections.length,
  };
}

function validateDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be a valid YYYY-MM-DD date.`);
  }
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be a real calendar date in YYYY-MM-DD format.`);
  }
  return value;
}

function validateBounds(bounds: CMRBounds): void {
  const values = [bounds.west, bounds.south, bounds.east, bounds.north];
  if (!values.every(Number.isFinite)
    || bounds.west < -180 || bounds.east > 180 || bounds.west >= bounds.east
    || bounds.south < -90 || bounds.north > 90 || bounds.south >= bounds.north) {
    throw new Error("The area bounds are invalid. Choose an area with valid longitude and latitude limits.");
  }
}

/**
 * Search real NISAR granule metadata for a chosen CMR collection.
 * An AOI bbox and date range are optional. Downloads may need Earthdata Login.
 */
export async function searchNISARGranules(options: {
  collectionConceptId: string;
  bounds?: CMRBounds | null;
  startDate?: string | null;
  endDate?: string | null;
  pageSize?: number;
  collectionShortName?: string;
}): Promise<{ granules: NISARGranule[]; hits: number }> {
  if (!/^C\d+-[A-Z0-9_-]+$/i.test(options.collectionConceptId)) {
    throw new Error("Choose a valid NASA CMR collection before searching for granules.");
  }
  const url = new URL(`${CMR_BASE}/granules.umm_json`);
  url.searchParams.set("collection_concept_id", options.collectionConceptId);
  url.searchParams.set("page_size", String(Math.max(1, Math.min(100, Math.floor(options.pageSize ?? 10)))));
  url.searchParams.append("sort_key[]", "-start_date");
  url.searchParams.set("browsable", "true");

  if (options.bounds) {
    validateBounds(options.bounds);
    const { west, south, east, north } = options.bounds;
    url.searchParams.set("bounding_box", [west, south, east, north].join(","));
  }
  if (options.startDate || options.endDate) {
    if (!options.startDate || !options.endDate) throw new Error("Choose both a start and end date.");
    const start = validateDate(options.startDate, "Start date");
    const end = validateDate(options.endDate, "End date");
    if (start > end) throw new Error("Start date must be on or before end date.");
    url.searchParams.append("temporal[]", `${start}T00:00:00Z,${end}T23:59:59Z`);
  }

  const data = await fetchCMR<CMRResponse>(url);
  if (!Array.isArray(data.items)) throw new Error("NASA CMR returned an unexpected granule response.");

  const granules: NISARGranule[] = data.items.flatMap((item) => {
    const meta = item.meta;
    const umm = item.umm;
    if (!meta || !umm) return [];
    const conceptId = textValue(meta["concept-id"] ?? meta.concept_id);
    const granuleId = textValue(umm.GranuleUR) || textValue(meta["native-id"] ?? meta.native_id);
    if (!conceptId || !granuleId) return [];
    const temporal = recordOf(umm.TemporalExtent);
    const range = recordOf(temporal?.RangeDateTime);
    const singleDate = textValue(temporal?.SingleDateTime) || "";
    const startDate = textValue(range?.BeginningDateTime) || singleDate || null;
    const endDate = textValue(range?.EndingDateTime) || singleDate || null;
    const dataCenters = Array.isArray(umm.DataCenters) ? umm.DataCenters : [];
    const dataCenter = textValue(recordOf(dataCenters[0])?.ShortName);
    const spatial = granuleSpatial(umm);
    const related = granuleRelatedUrls(umm);
    const productCode = (options.collectionShortName || granuleId).match(/GCOV|GSLC|GUNW|GOFF|RSLC|RIFG|ROFF|RUNW|SME2|CRSD|RRSD/i)?.[0]?.toUpperCase() || "NISAR";
    const title = textValue(umm.CollectionReference && recordOf(umm.CollectionReference)?.EntryTitle) || granuleId;
    const s3BrowseFallback = options.collectionShortName
      ? `https://sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/${encodeURIComponent(options.collectionShortName)}/${encodeURIComponent(granuleId)}/${encodeURIComponent(granuleId)}.png`
      : null;
    return [{
      id: `nisar:${conceptId}`,
      conceptId,
      granuleId,
      collectionConceptId: options.collectionConceptId,
      collectionShortName: options.collectionShortName || "",
      productCode,
      title,
      startDate,
      endDate,
      producer: dataCenter,
      bounds: spatial.bounds,
      footprint: spatial.footprint,
      browseUrl: related.browseUrl || s3BrowseFallback,
      dataUrl: related.dataUrl,
      metadataUrl: `https://cmr.earthdata.nasa.gov/search/concepts/${encodeURIComponent(conceptId)}`,
      earthdataSearchUrl: `https://search.earthdata.nasa.gov/search?q=${encodeURIComponent(granuleId)}`,
    }];
  });

  return {
    granules,
    hits: typeof data.hits === "number" && Number.isFinite(data.hits) ? data.hits : granules.length,
  };
}

export interface NISARCoverageResult {
  collections: NISARCollection[];
  collectionHits: number;
  productCollections: NISARCollection[];
  granules: NISARGranule[];
  granuleHits: number;
  warnings: string[];
}

/**
 * Discover available, real NISAR browseable products for the selected area and time.
 * It returns catalog metadata and browse links; it does not download or process HDF5 rasters.
 */
export async function searchNISARCoverage(options: {
  bounds?: CMRBounds | null;
  startDate: string;
  endDate: string;
}): Promise<NISARCoverageResult> {
  const catalog = await searchNISARCollections(100);
  const productCodes = ["GCOV", "GSLC", "GUNW", "SME2"];
  const selected: NISARCollection[] = [];
  const used = new Set<string>();

  for (const code of productCodes) {
    const candidates = catalog.collections.filter(collection =>
      new RegExp(`NISAR_(?:L[123]|L0B)_.*${code}_(?:PROVISIONAL|BETA)_V\\d+`, "i").test(collection.shortName),
    );
    candidates.sort((a, b) => {
      const provisional = (item: NISARCollection) => /PROVISIONAL/i.test(item.shortName) ? 1 : 0;
      return provisional(b) - provisional(a) ||
        (Date.parse(b.revisionDate || "") || 0) - (Date.parse(a.revisionDate || "") || 0);
    });
    const match = candidates[0];
    if (match && !used.has(match.conceptId)) {
      used.add(match.conceptId);
      selected.push(match);
    }
  }

  if (!selected.length) {
    throw new Error("NASA CMR returned no matching NISAR GCOV, GSLC, GUNW or SME2 product collections.");
  }

  const results = await Promise.allSettled(selected.map(collection =>
    searchNISARGranules({
      collectionConceptId: collection.conceptId,
      collectionShortName: collection.shortName,
      bounds: options.bounds,
      startDate: options.startDate,
      endDate: options.endDate,
      pageSize: 12,
    }),
  ));
  const granules: NISARGranule[] = [];
  const warnings: string[] = [];
  let granuleHits = 0;
  results.forEach((result, index) => {
    const collection = selected[index];
    if (!collection) return;
    if (result.status === "fulfilled") {
      granuleHits += result.value.hits;
      granules.push(...result.value.granules);
    } else {
      warnings.push(`${collection.shortName}: ${result.reason instanceof Error ? result.reason.message : "granule search failed"}`);
    }
  });

  granules.sort((a, b) => (Date.parse(b.startDate || "") || 0) - (Date.parse(a.startDate || "") || 0));
  return {
    collections: catalog.collections,
    collectionHits: catalog.hits,
    productCollections: selected,
    granules,
    granuleHits,
    warnings,
  };
}
