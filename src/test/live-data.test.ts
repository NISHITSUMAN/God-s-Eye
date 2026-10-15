import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchNASAEONETEvents, fetchUSGSEarthquakes } from "../lib/live-data";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockJSON(payload: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("public live event feeds", () => {
  it("normalizes USGS earthquake reports with official source links", async () => {
    const time = Date.parse("2026-10-15T08:30:00Z");
    mockJSON({
      features: [{
        id: "us7000test",
        type: "Feature",
        geometry: { type: "Point", coordinates: [72.8, 19.1, 12.4] },
        properties: {
          mag: 4.6,
          place: "25 km west of Mumbai, India",
          time,
          url: "https://earthquake.usgs.gov/earthquakes/eventpage/us7000test",
          magType: "mb",
          depth: 12.4,
          status: "reviewed",
        },
      }],
    });

    const events = await fetchUSGSEarthquakes();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "live:usgs:us7000test",
      source: "USGS",
      layerId: "live-usgs",
      type: "earthquake",
      lat: 19.1,
      lng: 72.8,
      metric: "M 4.6",
      date: "2026-10-15T08:30:00.000Z",
    });
    expect(events[0]?.sourceUrl).toContain("https://earthquake.usgs.gov/");
    expect(events[0]?.summary).toContain("Depth 12.4 km");
  });

  it("rejects invalid USGS coordinates and unsafe source links", async () => {
    mockJSON({
      features: [
        {
          id: "invalid",
          geometry: { type: "Point", coordinates: [181, 20, 4] },
          properties: { time: Date.parse("2026-10-15T08:30:00Z"), mag: 3 },
        },
        {
          id: "safe-fallback",
          geometry: { type: "Point", coordinates: [72, 19, 4] },
          properties: {
            time: Date.parse("2026-10-15T08:30:00Z"),
            mag: 3,
            url: "javascript:alert(1)",
          },
        },
      ],
    });

    const events = await fetchUSGSEarthquakes();
    expect(events).toHaveLength(1);
    expect(events[0]?.sourceUrl).toBe("https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php");
  });

  it("maps supported NASA EONET categories to separate live events", async () => {
    mockJSON({
      events: [
        {
          id: "EONET_123",
          title: "Example wildfire",
          description: "A source-reported open wildfire.",
          link: "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_123",
          categories: [{ id: "wildfires", title: "Wildfires" }],
          geometry: [{ date: "2026-10-14T12:00:00Z", type: "Point", coordinates: [78, 21] }],
        },
        {
          id: "EONET_UNSUPPORTED",
          title: "Unsupported category",
          categories: [{ id: "dustHaze", title: "Dust and Haze" }],
          geometry: [{ date: "2026-10-14T12:00:00Z", type: "Point", coordinates: [0, 0] }],
        },
      ],
    });

    const events = await fetchNASAEONETEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "live:eonet:EONET_123",
      source: "NASA EONET",
      layerId: "live-eonet",
      type: "fire",
      title: "Example wildfire",
      lng: 78,
      lat: 21,
    });
    expect(events[0]?.sourceUrl).toContain("https://eonet.gsfc.nasa.gov/");
    expect(events[0]?.summary).toContain("source-reported");
  });

  it("uses the latest usable geometry and bounds coordinate traversal", async () => {
    mockJSON({
      events: [{
        id: "EONET_POLYGON",
        title: "Example flood",
        categories: [{ id: "floods", title: "Floods" }],
        geometry: [
          { date: "2026-10-12T00:00:00Z", type: "Point", coordinates: [70, 20] },
          { date: "2026-10-14T00:00:00Z", type: "Polygon", coordinates: [[[70, 20], [72, 20], [72, 22], [70, 22], [70, 20]]] },
        ],
      }],
    });

    const events = await fetchNASAEONETEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.date).toBe("2026-10-14T00:00:00.000Z");
    expect(events[0]?.lng).toBeCloseTo(70.8);
    expect(events[0]?.lat).toBeCloseTo(20.8);
  });

  it("surfaces HTTP failures instead of silently pretending the feed is live", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));

    await expect(fetchUSGSEarthquakes()).rejects.toThrow("HTTP 503");
  });
});
