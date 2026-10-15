# Third Eye development status

## Implemented foundations
- CesiumJS 3D globe and MapLibre 2D map with shared view/selection state.
- Typed sample data boundary and visible sample-data warnings.
- Significance, confidence, severity, evidence, phenomenon, and temporal filters.
- Timeline/playback controls, search and a frontend command simulator.
- Area-of-interest tooling and sample analysis result routes.
- Catalog, observation detail, phenomenon detail, methodology, learn, data and report screens.

## Completed in this maintenance pass
- Replace the single low-resolution Natural Earth II 3D texture with configurable multi-resolution imagery, optional Cesium ion terrain, fallback handling, and visible source attribution.
- Fix the imagery status overlay so the normal Esri fallback is not reported as an error.
- Add selectable public USGS earthquake and NASA EONET natural-event layers to the 2D and 3D Earth views, search, context inspector, event catalog, and shared timeline.
- Add live NASA CMR collection and granule catalog discovery with optional date and AOI bounding-box filters.
- Harden AOI/GeoJSON validation, circle distance calculations, timeline range behavior, catalog reactivity, intro accessibility, and browser-storage fallbacks.
- Make prototype / sample-data limitations explicit across app metadata, detail pages, and reports.
- Replace the boilerplate README, add automated test/lint/build checks, and remove a stray test placeholder.

## Still requires live validation or real integrations
- Browser-test Cesium imagery requests, external-source CORS, and 2D/3D state synchronization with the intended provider and credentials.
- Configure a licensed high-resolution imagery provider appropriate for deployment, and confirm usage terms and attribution.
- Download, decode, and visualize real NISAR rasters; CMR currently retrieves catalog metadata only. Some product access may require Earthdata Login.
- Build and validate scientific processing for radar change detection, soil moisture, interferometry, deformation, and other analyses; sample analysis flows are not scientific measurements.
- Replace the front-end command simulator with a secured AI/backend integration if real language-model tool calling is needed.
- Run an end-to-end, route-by-route browser accessibility and responsive audit, especially on mobile WebGL devices.
