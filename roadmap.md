# Third Eye development status

## Implemented foundations
- CesiumJS 3D globe and MapLibre 2D map with shared view/selection state.
- Typed sample data boundary and visible sample-data warnings.
- Significance, confidence, severity, evidence, phenomenon, and temporal filters.
- Timeline/playback controls, search and a frontend command simulator.
- Area-of-interest tooling and sample analysis result routes.
- Catalog, observation detail, phenomenon detail, methodology, learn, data and report screens.

## Completed in this maintenance pass
- Replace the single low-resolution Natural Earth II 3D imagery source with provider configuration, a zoomable tile source, ion imagery support, fallback handling, and visible attribution.
- Keep ellipsoid terrain as a safe fallback and allow optional ion terrain.
- Update the project README with honest setup and provider instructions.
- Remove the accidentally committed test placeholder.

## Still requires live validation or real integrations
- Run `bun run test`, `bun run lint`, and `bun run build` in a local/CI environment.
- Browser-test Cesium imagery requests and 2D/3D state synchronization.
- Configure a licensed high-resolution satellite imagery provider if satellite imagery is desired.
- Connect real NISAR products and supporting datasets; all scientific overlays/results remain sample-only.
- Replace the frontend AI simulator with a secured backend if real AI/tool calling is needed.
- Audit accessibility and every route in a live browser.
