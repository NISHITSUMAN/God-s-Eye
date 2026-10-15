import { describe, expect, it } from "vitest";
import { circleAOI, makeAOI, rectangleAOI, validateGeometry } from "../lib/analysis";

describe("AOI construction", () => {
  it("normalizes reverse rectangle corners into a valid area", () => {
    const result = rectangleAOI([10, 10], [5, 4]);
    expect(result.bounds).toEqual([5, 4, 10, 10]);
    expect(result.areaKm2).toBeGreaterThan(0);
  });

  it("rejects a zero-width rectangle", () => {
    expect(() => rectangleAOI([10, 4], [10, 8])).toThrow(/different corners/i);
  });

  it("rejects invalid circle radii", () => {
    expect(() => circleAOI([0, 0], Number.NaN)).toThrow(/radius/i);
    expect(() => circleAOI([0, 0], 0)).toThrow(/radius/i);
  });

  it("preserves all geometries in a FeatureCollection", () => {
    const collection = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { name: "one" }, geometry: { type: "Point", coordinates: [10, 20] } },
        { type: "Feature", properties: { name: "two" }, geometry: { type: "Point", coordinates: [30, 40] } },
      ],
    };
    const result = validateGeometry(collection);
    expect(result.geometry.type).toBe("GeometryCollection");
    if (result.geometry.type === "GeometryCollection") expect(result.geometry.geometries).toHaveLength(2);
  });

  it("rejects empty or invalid coordinates before Turf sees them", () => {
    expect(() => validateGeometry({ type: "Point", coordinates: [] })).toThrow(/coordinates/i);
    expect(() => validateGeometry({ type: "Point", coordinates: [181, 0] })).toThrow(/longitude/i);
    expect(() => validateGeometry({ type: "Polygon", coordinates: [] })).toThrow(/coordinates/i);
  });

  it("enforces the vertex limit", () => {
    const points = Array.from({ length: 10001 }, (_, i) => [((i % 350) / 2), ((i % 150) / 2)]);
    expect(() => validateGeometry({ type: "LineString", coordinates: points })).toThrow(/10,000 vertices/i);
  });

  it("rejects an AOI with non-finite bounds", () => {
    expect(() => makeAOI({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [[]] },
    } as never)).toThrow();
  });
});
