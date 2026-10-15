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

export interface NISARGranule {
  conceptId: string;
  granuleId: string;
  startDate: string | null;
  endDate: string | null;
  producer: string;
  metadataUrl: string;
  earthdataSearchUrl: string;
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} must be a valid YYYY-MM-DD date.`);
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
}): Promise<{ granules: NISARGranule[]; hits: number }> {
  if (!/^C\d+-[A-Z0-9_-]+$/i.test(options.collectionConceptId)) {
    throw new Error("Choose a valid NASA CMR collection before searching for granules.");
  }
  const url = new URL(`${CMR_BASE}/granules.umm_json`);
  url.searchParams.set("collection_concept_id", options.collectionConceptId);
  url.searchParams.set("page_size", String(Math.max(1, Math.min(100, Math.floor(options.pageSize ?? 10)))));
  url.searchParams.append("sort_key[]", "-start_date");

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
    const temporal = umm.TemporalExtent && typeof umm.TemporalExtent === "object"
      ? umm.TemporalExtent as Record<string, unknown>
      : {};
    const range = temporal.RangeDateTime && typeof temporal.RangeDateTime === "object"
      ? temporal.RangeDateTime as Record<string, unknown>
      : {};
    const startDate = textValue(range.BeginningDateTime) || null;
    const endDate = textValue(range.EndingDateTime) || null;
    const dataCenter = Array.isArray(umm.DataCenters) && umm.DataCenters[0] && typeof umm.DataCenters[0] === "object"
      ? textValue((umm.DataCenters[0] as Record<string, unknown>).ShortName)
      : "";
    return [{
      conceptId,
      granuleId,
      startDate,
      endDate,
      producer: dataCenter,
      metadataUrl: `https://cmr.earthdata.nasa.gov/search/concepts/${encodeURIComponent(conceptId)}`,
      earthdataSearchUrl: `https://search.earthdata.nasa.gov/search?q=${encodeURIComponent(granuleId)}`,
    }];
  });

  return {
    granules,
    hits: typeof data.hits === "number" && Number.isFinite(data.hits) ? data.hits : granules.length,
  };
}
