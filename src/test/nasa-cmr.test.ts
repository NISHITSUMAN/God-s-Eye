import { afterEach, describe, expect, it, vi } from "vitest";
import { searchNISARCollections, searchNISARGranules, searchNISARCoverage } from "../lib/nasa-cmr";

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

  it("prefers exact polygon footprints and searches granules by collection, area, and time", async () => {
    const fetchMock = mockCMR({
      hits: 35,
      items: [{
        meta: { "concept-id": "G12345-ASF", "native-id": "granule-native-id" },
        umm: {
          GranuleUR: "NISAR_L2_GCOV_SAMPLE",
          TemporalExtent: { RangeDateTime: { BeginningDateTime: "2026-09-10T12:00:00Z", EndingDateTime: "2026-09-10T12:01:00Z" } },
          DataCenters: [{ ShortName: "ASF" }],
          SpatialExtent: {
            HorizontalSpatialDomain: {
              Geometry: {
                BoundingRectangles: [{ WestBoundingCoordinate: 71, SouthBoundingCoordinate: 19, EastBoundingCoordinate: 73, NorthBoundingCoordinate: 21 }],
              },
            },
          },
          RelatedUrls: [
            { Type: "GET RELATED VISUALIZATION", URLContentType: "Visualization", URL: "https://browse.example.org/granule.png" },
            { Type: "GET DATA", URLContentType: "DistributionURL", URL: "https://data.example.org/granule.h5" },
          ],
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
      productCode: "GCOV",
      bounds: { west: 71, south: 19, east: 72.5, north: 20.5 },
      footprint: [[71, 19], [72.5, 19.2], [72.4, 20.5], [71.2, 20], [71, 19]],
      browseUrl: "https://browse.example.org/granule.png",
      dataUrl: "https://data.example.org/granule.h5",
    });
    const requested = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requested.pathname).toContain("/granules.umm_json");
    expect(requested.searchParams.get("collection_concept_id")).toBe("C12345-ASF");
    expect(requested.searchParams.get("bounding_box")).toBe("70,18,74,22");
    expect(requested.searchParams.get("temporal[]")).toBe("2026-09-01T00:00:00Z,2026-09-30T23:59:59Z");
    expect(requested.searchParams.get("page_size")).toBe("12");
    expect(requested.searchParams.has("browsable")).toBe(false);
  });

  it("discovers real product-family collections and combines matching granules", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200, json: async () => ({
          hits: 2,
          items: [
            { meta: { "concept-id": "C100-ASF", "revision-date": "2026-10-01T00:00:00Z" }, umm: { ShortName: "NISAR_L2_GCOV_PROVISIONAL_V1", EntryTitle: "NISAR GCOV", Version: "1", Abstract: "" } },
            { meta: { "concept-id": "C200-ASF", "revision-date": "2026-10-01T00:00:00Z" }, umm: { ShortName: "NISAR_L2_GSLC_PROVISIONAL_V1", EntryTitle: "NISAR GSLC", Version: "1", Abstract: "" } },
          ],
        }),
      })
      .mockResolvedValue({
        ok: true, status: 200, json: async () => ({
          hits: 1,
          items: [{
            meta: { "concept-id": "G100-ASF", "native-id": "granule-1" },
            umm: {
              GranuleUR: "NISAR_TEST_GRANULE",
              TemporalExtent: { RangeDateTime: { BeginningDateTime: "2026-09-10T12:00:00Z", EndingDateTime: "2026-09-10T12:01:00Z" } },
              SpatialExtent: { HorizontalSpatialDomain: { Geometry: { BoundingRectangles: [{ WestBoundingCoordinate: 71, SouthBoundingCoordinate: 19, EastBoundingCoordinate: 73, NorthBoundingCoordinate: 21 }] } } },
              RelatedUrls: [{ Type: "GET RELATED VISUALIZATION", URLContentType: "Visualization", URL: "https://browse.example.org/granule.png" }],
            },
          }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchNISARCoverage({
      bounds: { west: 70, south: 18, east: 74, north: 22 },
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    });

    expect(result.productCollections.map(item => item.shortName)).toEqual([
      "NISAR_L2_GCOV_PROVISIONAL_V1",
      "NISAR_L2_GSLC_PROVISIONAL_V1",
    ]);
    expect(result.collections).toHaveLength(2);
    expect(result.granules).toHaveLength(2);
    expect(result.granules[0]).toMatchObject({
      productCode: "GCOV",
      bounds: { west: 71, south: 19, east: 73, north: 21 },
      browseUrl: "https://browse.example.org/granule.png",
    });
    expect(new URL(String(fetchMock.mock.calls[1]?.[0])).searchParams.has("browsable")).toBe(false);
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
