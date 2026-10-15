# Third Eye

Third Eye is an Earth-observation exploration prototype. It combines an interactive 3D Earth (CesiumJS), a 2D map (MapLibre), sample environmental events and observations, timeline controls, area-of-interest tools, scientific detail pages, and a frontend command simulator.

> **Data honesty:** event points, polygons, tracks, observation metadata, metrics and analysis results in this repository are illustrative sample data. They are not live NASA/NISAR measurements. Basemap imagery is a separate geographic context layer.

## Run locally

Requirements: a current Node.js version compatible with Vite 8, or Bun.

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

The 3D globe uses a multi-level imagery provider instead of relying solely on the low-resolution bundled Natural Earth II image.

- **Default:** Esri World Imagery, a tiled satellite/aerial basemap, with provider attribution enabled in Cesium's on-screen credit area. Imagery sharpness varies by place and available zoom level; it is not a guarantee of street-level detail.
- **Optional custom imagery:** set `VITE_EARTH_IMAGERY_URL` to a tile URL template with `{z}`, `{x}`, and `{y}`, plus `VITE_EARTH_IMAGERY_ATTRIBUTION`. Use only a provider whose licence, terms and usage limits permit this application.
- **Optional Cesium ion imagery:** set `VITE_CESIUM_ION_TOKEN` and, if needed, `VITE_CESIUM_ION_IMAGERY_ASSET_ID`. The default asset ID is `2`; check that the asset is available to your account and that its terms/attribution/quota are appropriate.
- **Optional 3D terrain:** set `VITE_CESIUM_TERRAIN=true` with a valid ion token and terrain access. If the terrain request fails, the globe retains ellipsoid terrain.
- If the preferred tile provider reports repeated tile errors, the globe falls back to Esri imagery and then the bundled low-resolution Natural Earth II image.

Example local `.env.local` (leave token empty unless you have configured ion access; do not commit real secrets):

```dotenv
VITE_CESIUM_ION_TOKEN=
VITE_CESIUM_ION_IMAGERY_ASSET_ID=2
VITE_CESIUM_TERRAIN=false
VITE_EARTH_IMAGERY_URL=
VITE_EARTH_IMAGERY_ATTRIBUTION=
```

Variables prefixed with `VITE_` are exposed in the browser bundle. Only use client-scoped tokens, restrict them by domain where the provider supports it, and never put server secrets in client environment variables.

## Current limitations

- All scientific event and observation layers remain sample-only.
- The command/AI experience is a frontend simulator; it does not use a real LLM or live tools.
- Analysis routes document a sample workflow; they do not preprocess or interpret real radar rasters.
- A detailed satellite basemap does not provide NISAR measurements. Real products need a separate ingestion, processing, validation, provenance and visualization pipeline.
- Run the test, lint and production build commands locally, then verify imagery loads in a real browser with WebGL and the chosen provider's terms/credentials.
