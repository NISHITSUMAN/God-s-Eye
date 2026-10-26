# Third Eye

Third Eye is an Earth-observation exploration prototype. It combines an interactive 3D Earth (CesiumJS), a 2D map (MapLibre), sample environmental events and observations, timeline controls, area-of-interest tools, scientific detail pages, and a frontend command simulator.

> **Data honesty:** the app now connects to official public source metadata for NASA's Common Metadata Repository (NISAR collections and granules), USGS earthquakes, and NASA EONET open natural events. Those connections return source catalog records, not processed radar measurements. The other event points, polygons, observation metadata, metrics, and analysis results remain illustrative sample data. Basemap imagery is a separate geographic context layer.

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

## Connected public data sources

- **NASA CMR / NISAR catalog:** the Data page can query current collection metadata and search granules by selected collection, time range, and (when present) the AOI bounding box. It links to official CMR metadata and Earthdata Search. It does not download or process the product files. Some data access workflows require an Earthdata Login.
- **USGS earthquakes:** the Live Layers panel fetches the USGS public GeoJSON feed for earthquakes reported in the last 24 hours. Records retain magnitude, time, location, and source URLs where available.
- **NASA EONET:** the Live Layers panel fetches open natural events, and maps supported wildfire, flood, landslide, and volcanic categories when a valid location is present.
- Public-source records are displayed as **live context**, not as NISAR observations, predicted hazards, or Third Eye scientific detections. They can be unavailable if the source, network, or browser access fails. Refresh is manual; these are not continuous streaming feeds.

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

- The NASA CMR integration retrieves live catalog metadata, but NISAR raster products are not downloaded, rendered as scientific rasters, or processed in the current app. Other scientific event and observation layers remain sample-only.
- The command/AI experience is a frontend simulator; it does not use a real LLM or live tools.
- Analysis routes document a sample workflow; they do not preprocess or interpret real radar rasters.
- A detailed satellite basemap does not provide NISAR measurements. Real products need a separate ingestion, processing, validation, provenance and visualization pipeline.
- Run the test, lint and production build commands locally, then verify imagery loads in a real browser with WebGL and the chosen provider's terms/credentials.


## Globe imagery and zoom overlays

The 3D Earth uses Esri World Imagery for the satellite/aerial basemap. Separate transparent Esri reference layers fade in above it: place names and administrative boundaries appear while zooming in, while roads/transportation references appear at closer scales. These are geographic context layers, not NISAR measurements; Cesium displays the source attribution.

The 2D MapLibre view remains an alternate view. It does not replace the main 3D globe during zoom.

## Backend API

- GET /api/health reports backend status and whether an AI provider key is configured. It never returns secret values.
- GET /api/nisar/coverage queries NASA CMR for live NISAR collections and granules. It accepts startDate, endDate, products, and optional west/south/east/north bounds. Public catalog results are cached for five minutes.
- GET /api/assistant reports whether an AI provider is configured.
- POST /api/assistant uses Vercel AI Gateway or an OpenAI-compatible provider when configured. It validates messages and model-proposed actions against a strict map/layer allowlist. Without a key, basic commands use a deterministic safe fallback.

### Configure AI on Vercel

In Project → Settings → Environment Variables, add server-side variables in the environments where you want AI enabled:

    AI_GATEWAY_API_KEY=your_server_side_gateway_key
    AI_MODEL=openai/gpt-4.1-mini

Alternatively, for an OpenAI-compatible provider:

    AI_API_KEY=your_server_side_provider_key
    AI_BASE_URL=https://api.openai.com/v1
    AI_MODEL=gpt-4.1-mini

Do not use VITE_* for private secrets: Vite variables become browser-visible. Add the key only in Vercel's server environment, then redeploy. NISAR catalog access works without an AI key.

The assistant endpoint has request-size validation and a small per-runtime throttle. That throttle is not globally shared; before using a public AI key for high traffic, configure Vercel Firewall rate limits or a shared rate-limit service.

## NISAR data scope

Third Eye queries live NASA CMR metadata and displays source-provided granule footprints/bounds on the globe. These shapes show published acquisition coverage; they are not flood extent, deformation measurements, fire/damage detection, or other derived results. CMR records and product links are real, but full NISAR HDF5 product download and georeferenced raster/tile processing are not implemented here. That requires a separate ingestion, validation and scientific processing pipeline. A basemap or catalog footprint must not be described as processed radar imagery.

See the NASA NISAR mission page (https://science.nasa.gov/mission/nisar/), ASF NISAR availability overview (https://nisar-docs.asf.alaska.edu/availability-overview/), and ISRO NISAR S-band release notes (https://www.isro.gov.in/NISARS_Band_SAR_Data_Products_Release.html).
