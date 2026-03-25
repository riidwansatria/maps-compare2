# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server (localhost:5173)
npm run build        # Production build to dist/
npm run type-check   # tsc --noEmit
npm run lint         # ESLint on src/
npm run format       # Prettier on src/
```

## Path Aliases

`@/*` resolves to `src/*` (configured in both tsconfig.json and vite.config.js).

## Architecture

Dual-map comparison tool for GSI (Japan Geospatial Information Authority) tile layers. React 19 + TypeScript + MapLibre GL JS 5 + Tailwind CSS 4.

### Two display modes

- **Side-by-side**: Two `MapPane` components, each with its own MapLibre instance and Geoman draw layer. Optional viewport sync locks pan/zoom/rotate between panels.
- **Overlay**: Single `OverlayMapPane` with two raster tile sources stacked, controlled by an opacity slider.

Mode switching unmounts/remounts map components entirely.

### Tile layer swapping

`MapPane` creates a stable MapLibre style once via `useMemo(() => GSI_STYLES[layerKey], [])` and never calls `setStyle()` again. Layer changes go through `TileLayerSwapper`, which calls `source.setTiles()` on the existing raster source. This preserves all other sources/layers (Geoman drawings, GeoJSON overlays) across layer switches.

`OverlayMapPane` uses a different approach: `OverlayLayerManager` manually removes and re-adds base/overlay sources and layers since it manages two separate raster sources.

### Drawing system (Geoman)

Geoman runs **headless** (`controlsUiEnabledByDefault: false`) because its built-in toolbar UI doesn't survive React StrictMode double-mount. `DrawControl` initializes Geoman and exposes the instance via `onGeomanReady`. A separate `DrawToolbar` component drives all instances through Geoman's API.

**Cross-panel sync**: App holds a single canonical `drawnFeatures` state. A `drawEditSourceRef` (mutable ref) tracks which panel last edited. Each `DrawControl` receives a `panelId` and skips syncing when it is the edit source. The sync effect properly `await`s Geoman's async `deleteAll()` and `importGeoJson()` with a version counter to cancel stale operations.

### Map wrapper

Uses `@mapcn/map` (shadcn-compatible MapLibre wrapper). Key API: `<Map>` provides context, `useMap()` returns `{ map, isLoaded }` where `isLoaded` is true only when both map instance and style are loaded. All child components that interact with MapLibre must guard on `isLoaded`.

### State management

No external state library. App.tsx lifts all shared state:
- `useViewportSync` — shared viewport + sync toggle
- `useCompareMode` — side-by-side/overlay mode + overlay opacity
- `useLayerSelection` — left/right layer keys
- `useGeoJSON` — file loading + localStorage persistence
- Geoman instances (`leftGm`, `rightGm`) and drawn features as useState/useRef in App

## UI Language

All user-facing labels are in **Japanese**. Maintain this convention.

## Key Pitfalls

- **Never call `map.setStyle()`** in MapPane — it wipes all Geoman and GeoJSON layers. Use `source.setTiles()` instead.
- **Geoman APIs are async** — `deleteAll()`, `importGeoJson()`, `enableDraw()`, etc. return Promises. Always await them, especially in sync logic.
- **Cleanup effects need try/catch** — mapcn may `map.remove()` before child component cleanup runs during mode switches.
- **`importGeoJson` type mismatch** — Geoman's `GeoJsonImportFeatureCollection` is narrower than GeoJSON's `FeatureCollection`. Use `as any` cast.
