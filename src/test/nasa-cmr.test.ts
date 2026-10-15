import { afterEach, describe, expect, it, vi } from "vitest";
import { searchNISARCollections, searchNISARGranules } from "../lib/nasa-cmr";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockCMR(payload: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("NASA CMR metadata adapter", () => {
  it("normalizes public NISAR collection metadata and ignores unrelated records", async () => {
    const fetchMock = mockCMR({
      hits: 2,
      items: [
        {
          meta: { "concept-id": "C12345-ASF", "revision-date": "2026-10-01T00:00:00Z" },
          umm: {
            ShortName: "NISAR_L2_GCOV_PROVISIONAL_V1",
            EntryTitle: "NISAR Provisional Geocoded Covariance Product",
            Version: "1",
            Abstract: "A <b>sample</b> abstract with &amp; entities.",
            DOI: { DOI: "10.5067/NISAR/GCOV.001" },
            ProcessingLevel: { Id: "2" },
            TemporalExtents: [{ RangeDateTime: { BeginningDateTime: "2026-01-01T00:00:00Z", EndingDateTime: "2026-10-01T00:00:00Z" } }],
          },
        },
        {
          meta: { "concept-id": "C99999-OTHER" },
          umm: { ShortName: "OTHER", EntryTitle: "Unrelated dataset" },
        },
      ],
    });

    const result = await searchNISARCollections();
    expect(result.hits).toBe(2);
    expect(result.collections).toHaveLength(1);
    expect(result.collections[0]).toMatchObject({
      conceptId: "C12345-ASF",
      shortName: "NISAR_L2_GCOV_PROVISIONAL_V1",
      version: "1",
      processingLevel: "2",
      doi: "10.5067/NISAR/GCOV.001",
      startDate: "2026-01-01T00:00:00Z",
      endDate: "2026-10-01T00:00:00Z",
      abstract: "A sample abstract with & entities.",
    });
    expect(result.collections[0]?.metadataUrl).toBe("https://cmr.earthdata.nasa.gov/search/concepts/C12345-ASF");
    const requested = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requested.hostname).toBe("cmr.earthdata.nasa.gov");
    expect(requested.searchParams.get("keyword")).toBe("NISAR");
    expect(requested.searchParams.get("has_granules")).toBe("true");
  });

  it("searches granules by collection, AOI bounding box, and temporal range", async () => {
    const fetchMock = mockCMR({
      hits: 35,
      items: [{
        meta: { "concept-id": "G12345-ASF", "native-id": "granule-native-id" },
        umm: {
          GranuleUR: "NISAR_L2_GCOV_SAMPLE",
          TemporalExtent: { RangeDateTime: { BeginningDateTime: "2026-09-10T12:00:00Z", EndingDateTime: "2026-09-10T12:01:00Z" } },
          DataCenters: [{ ShortName: "ASF" }],
        },
      }],
    });

    const result = await searchNISARGranules({
      collectionConceptId: "C12345-ASF",
      bounds: { west: 70, south: 18, east: 74, north: 22 },
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      pageSize: 12,
    });

    expect(result.hits).toBe(35);
    expect(result.granules).toHaveLength(1);
    expect(result.granules[0]).toMatchObject({
      conceptId: "G12345-ASF",
      granuleId: "NISAR_L2_GCOV_SAMPLE",
      startDate: "2026-09-10T12:00:00Z",
      producer: "ASF",
    });
    const requested = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requested.pathname).toContain("/granules.umm_json");
    expect(requested.searchParams.get("collection_concept_id")).toBe("C12345-ASF");
    expect(requested.searchParams.get("bounding_box")).toBe("70,18,74,22");
    expect(requested.searchParams.get("temporal[]")).toBe("2026-09-01T00:00:00Z,2026-09-30T23:59:59Z");
    expect(requested.searchParams.get("page_size")).toBe("12");
  });

  it("rejects malformed IDs, dates, and bounds before making a request", async () => {
    const fetchMock = mockCMR({ hits: 0, items: [] });
    await expect(searchNISARGranules({ collectionConceptId: "bad-id" })).rejects.toThrow(/collection/i);
    await expect(searchNISARGranules({
      collectionConceptId: "C12345-ASF",
      startDate: "2026-10-01",
      endDate: "2026-09-01",
    })).rejects.toThrow(/on or before/i);
    await expect(searchNISARGranules({
      collectionConceptId: "C12345-ASF",
      startDate: "2026-02-31",
      endDate: "2026-03-01",
    })).rejects.toThrow(/real calendar date/i);
    await expect(searchNISARGranules({
      collectionConceptId: "C12345-ASF",
      bounds: { west: 181, south: 0, east: 190, north: 10 },
    })).rejects.toThrow(/bounds/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports HTTP and unexpected response errors clearly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
    await expect(searchNISARCollections()).rejects.toThrow(/HTTP 503/i);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ notItems: [] }) }));
    await expect(searchNISARCollections()).rejects.toThrow(/unexpected collection response/i);
  });
});
