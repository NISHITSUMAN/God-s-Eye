import { createFileRoute } from "@tanstack/react-router";
import { searchNISARCoverage, type CMRBounds } from "@/lib/nasa-cmr";

const PRODUCTS = ["GCOV", "GSLC", "GUNW", "GOFF", "RSLC", "RIFG", "ROFF", "RUNW", "SME2"] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDay(value: string | null): string | null {
  if (!value || !DATE.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? value : null;
}
function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/nisar/coverage")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const now = new Date();
        const endDefault = now.toISOString().slice(0, 10);
        const startDefaultDate = new Date(now);
        startDefaultDate.setUTCFullYear(startDefaultDate.getUTCFullYear() - 2);
        const startDate = validDay(url.searchParams.get("startDate") ?? startDefaultDate.toISOString().slice(0, 10));
        const endDate = validDay(url.searchParams.get("endDate") ?? endDefault);
        if (!startDate || !endDate || startDate > endDate) {
          return fail("Use valid startDate and endDate values in YYYY-MM-DD format; startDate must not follow endDate.", 400);
        }

        const requested = (url.searchParams.get("products") ?? "GCOV,GSLC,GUNW,SME2").split(",").map(v => v.trim().toUpperCase()).filter(Boolean);
        const productCodes = [...new Set(requested)].filter(v => (PRODUCTS as readonly string[]).includes(v)).slice(0, 5);
        if (!productCodes.length) return fail(`Choose supported NISAR product families: ${PRODUCTS.join(", ")}.`, 400);

        const keys = ["west", "south", "east", "north"] as const;
        const rawBounds = keys.map(key => url.searchParams.get(key));
        let bounds: CMRBounds;
        if (rawBounds.some(value => value !== null)) {
          const values = rawBounds.map(value => value === null ? NaN : Number(value));
          if (!values.every(Number.isFinite)) return fail("Supply all four AOI bounds (west, south, east, north) as numbers.", 400);
          const [west, south, east, north] = values as [number, number, number, number];
          if (west < -180 || east > 180 || west >= east || south < -90 || north > 90 || south >= north) {
            return fail("The AOI bounds are outside valid longitude/latitude ranges.", 400);
          }
          bounds = { west, south, east, north };
        } else {
          bounds = { west: 68, south: 6, east: 98, north: 38 };
        }

        try {
          const result = await searchNISARCoverage({ bounds, startDate, endDate, productCodes });
          return Response.json({ ...result, fetchedAt: new Date().toISOString(), source: "NASA CMR", dataKind: "catalog-metadata" }, {
            headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" },
          });
        } catch (error) {
          console.error("NASA CMR coverage query failed.", error);
          return fail(error instanceof Error ? error.message : "NASA CMR could not be queried.", 502);
        }
      },
    },
  },
});
