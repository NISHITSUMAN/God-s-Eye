# Third Eye

Third Eye is an Earth-observation exploration prototype. It combines an interactive 3D Earth (CesiumJS/Resium), a 2D map (MapLibre), sample environmental events and observations, timeline controls, area-of-interest analysis flows, and a frontend command simulator.

> **Data honesty:** event points, polygons, observation metadata, measurements, analysis results, and tracks in this repository are illustrative sample data. They are not live NASA/NISAR measurements. The basemap is separate from scientific datasets.

## Requirements

- Node.js compatible with the versions supported by Vite 8 and the project dependencies.
- Bun is recommended because the repository includes `bun.lock`. npm can also be used with `package.json`.

## Run locally

```sh
git clone https://github.com/NISHITSUMAN/God-s-Eye.git
cd God-s-Eye
bun install
bun run dev
```

Or with npm:

```sh
npm install
npm run dev
```

Useful checks:

```sh
bun run test
bun run lint
bun run build
```

## Earth imagery and terrain

The 3D globe no longer relies on the bundled low-resolution Natural Earth II texture as its only imagery source.

- Default fallback: OpenStreetMap standard raster tiles. This is a street/map basemap, not satellite imagery. Respect the provider's usage policy and keep attribution visible.
- Recommended higher-detail option: configure a suitable multi-resolution XYZ imagery provider using `VITE_EARTH_IMAGERY_URL` and `VITE_EARTH_IMAGERY_ATTRIBUTION`. Use a provider whose terms allow your use and which supports the desired zoom levels. Use only credentials intended for browser use.
- Optional Cesium ion imagery: set `VITE_CESIUM_ION_TOKEN`. Optionally set `VITE_CESIUM_ION_IMAGERY_ASSET_ID` to the ID of an imagery asset available to your account. Verify the asset's license, attribution and quota.
- Optional terrain: set `VITE_CESIUM_TERRAIN=true` with a valid Cesium ion token and terrain access. If it fails, the globe stays on ellipsoid terrain.

Example local `.env.local` (do not commit real secrets):

```dotenv
VITE_CESIUM_ION_TOKEN=
VITE_CESIUM_ION_IMAGERY_ASSET_ID=2
VITE_CESIUM_TERRAIN=false
VITE_EARTH_IMAGERY_URL=
VITE_EARTH_IMAGERY_ATTRIBUTION=
```

The `VITE_` values are exposed to the browser bundle. Only put public/client-scoped tokens here, restrict them with provider-side URL/domain settings, and never put server secrets in client environment variables.

## Current limitations

- Scientific event and observation layers are sample-only.
- The command/AI experience is a frontend simulator; it does not call a real LLM or tool-calling backend.
- Analysis results are sample placeholders, not processed NISAR rasters or scientific estimates.
- A sharper basemap does not supply NISAR data. Real products need a separate data ingestion, processing, provenance and visualization pipeline.
- Browser/WebGL testing and real provider credentials are needed to verify the exact imagery quality available in your environment.
