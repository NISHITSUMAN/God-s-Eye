// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  vite: {
    define: {
      CESIUM_BASE_URL: JSON.stringify("/cesium"),
    },
    plugins: [
      viteStaticCopy({
        targets: [
          { src: "node_modules/cesium/Build/Cesium/Workers", dest: "cesium" },
          { src: "node_modules/cesium/Build/Cesium/ThirdParty", dest: "cesium" },
          { src: "node_modules/cesium/Build/Cesium/Assets", dest: "cesium" },
          { src: "node_modules/cesium/Build/Cesium/Widgets", dest: "cesium" },
        ],
      }),
    ],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
