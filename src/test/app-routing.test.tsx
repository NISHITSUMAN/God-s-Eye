import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";

function makeRouter(path: string) {
  return createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App route registration", () => {
  it("registers the Earth-first index route", () => {
    const router = makeRouter("/");
    expect(router.routesByPath["/"]).toBeDefined();
    expect(router.routesByPath["/"].id).toBe("/");
  });

  it("registers the requested page routes and dynamic detail routes", () => {
    const router = makeRouter("/observations/OBS-123");
    expect(router.routesByPath["/observations"]).toBeDefined();
    expect(router.routesByPath["/observations/$id"]).toBeDefined();
    expect(router.routesByPath["/analysis/$id"]).toBeDefined();
    expect(router.routesByPath["/reports/create"]).toBeDefined();
  });

  it("does not mistake unknown paths for registered application routes", () => {
    const router = makeRouter("/this-route-does-not-exist");
    expect(router.routesByPath["/this-route-does-not-exist"]).toBeUndefined();
  });
});
