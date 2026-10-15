// The Lovable Vite wrapper supplies the normal TanStack Start, React, Tailwind,
// path-alias and Nitro plugins. On Vercel, explicitly override its Cloudflare default:
// Vercel needs its own Build Output API directory for static Cesium assets and functions.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";

export default defineConfig({
  vite: {
    // Keep Cesium's runtime resources in the public tree for both local and hosted builds.
    publicDir: "public",
    define: {
      CESIUM_BASE_URL: JSON.stringify("/cesium"),
    },
  },
  ...(isVercel
    ? {
        nitro: {
          preset: "vercel",
          output: {
            dir: ".vercel/output",
            serverDir: ".vercel/output/functions/__server.func",
            publicDir: ".vercel/output/static",
          },
        },
      }
    : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
});
