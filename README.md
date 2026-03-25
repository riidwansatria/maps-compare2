# maps-compare2

Interactive dual-map comparison tool for GSI (Geospatial Information Authority of Japan) tile layers. Compare historical aerial photos, standard maps, and third-party map sources side by side or with an overlay.

## Features

- **Side-by-side mode** — Two independent map panels with optional viewport sync (pan/zoom/rotate lock)
- **Overlay mode** — Two layers stacked with an adjustable opacity slider for blending
- **15 tile layers** — GSI standard, aerial photos (1928–present), relief, land use, plus OpenStreetMap and Google Maps
- **Drawing tools** — Pin, line, polygon, circle, rectangle via Geoman; synced across both panels in real time
- **Measurements** — Automatic distance (haversine) and area calculations for drawn features
- **GeoJSON import** — Load `.geojson` files via file picker or drag-and-drop; persisted in localStorage
- **Address search** — GSI address geocoder (住所検索) with fly-to navigation
- **Map export** — Download the current map view as a PNG image
- **Keyboard shortcuts** — `Space` toggle sync, `M` toggle mode, `Ctrl/Cmd+O` open file

## Tech Stack

- **React 19** + TypeScript
- **MapLibre GL JS 5** via [@mapcn/map](https://github.com/mapcn/map) (shadcn-compatible wrapper)
- **@geoman-io/maplibre-geoman-free** for drawing tools
- **Tailwind CSS 4** + shadcn/ui components
- **Vite 7** for dev/build

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run serve` | Serve on port 3000 |
| `npm run type-check` | Run `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Architecture

```
src/
├── App.tsx                    # Root layout: toolbar, mode switching, state management
├── components/
│   ├── MapPane.tsx            # Single map panel (side-by-side mode)
│   ├── OverlayMapPane.tsx     # Dual-layer map panel (overlay mode)
│   ├── DrawControl.tsx        # Headless Geoman initializer + cross-panel sync
│   ├── DrawToolbar.tsx        # Floating toolbar for draw tools + measurements
│   ├── LayerSelect.tsx        # Tile layer dropdown
│   ├── OpacitySlider.tsx      # Overlay opacity control
│   ├── LocationSearch.tsx     # GSI address geocoder dialog
│   ├── GeoJSONUpload.tsx      # File picker + drag-and-drop overlay
│   ├── AttributionBar.tsx     # Map attribution display
│   └── ui/                    # shadcn/ui primitives (button, select, map, etc.)
├── hooks/
│   ├── useViewportSync.ts     # Shared viewport state + sync toggle
│   ├── useCompareMode.ts      # Side-by-side / overlay mode + opacity state
│   ├── useLayerSelection.ts   # Left/right layer selection state
│   └── useGeoJSON.ts          # GeoJSON file loading + localStorage persistence
└── lib/
    ├── gsi-styles.ts          # GSI tile layer definitions + URL helpers
    ├── overlay-style.ts       # MapLibre style builder for overlay mode
    └── export-map.ts          # Canvas-to-PNG export utility
```

### Key Design Decisions

**Tile swapping without style replacement** — Changing the base map layer calls `source.setTiles()` on the existing raster source rather than replacing the entire MapLibre style via `map.setStyle()`. This preserves all Geoman drawing layers and GeoJSON overlays across layer switches.

**Single canonical draw state** — Both map panels have their own Geoman instance, but drawn features are stored as a single `drawnFeatures` state in App. A `drawEditSourceRef` tracks which panel last edited, so the source panel skips importing its own changes, preventing sync loops.

**Async-safe sync** — Geoman's `deleteAll()` and `importGeoJson()` are async. The sync effect properly awaits them with a version counter to cancel stale operations from overlapping calls.

**Headless Geoman + custom toolbar** — Geoman's built-in toolbar UI doesn't survive React StrictMode remounts. Instead, `DrawControl` runs headless (`controlsUiEnabledByDefault: false`) and a separate `DrawToolbar` component drives all Geoman instances via their API.

## Available Tile Layers

| Key | Label | Source |
|-----|-------|--------|
| `standard` | GSI 標準地図 | GSI |
| `seamlessphoto` | GSI 写真 | GSI |
| `pale` | GSI 淡色地図 | GSI |
| `relief` | GSI 陰影起伏図 | GSI |
| `landuse` | GSI 土地利用図 | GSI |
| `gazo4` | GSI 1987〜1990年 | GSI |
| `gazo3` | GSI 1984〜1986年 | GSI |
| `gazo2` | GSI 1979〜1983年 | GSI |
| `gazo1` | GSI 1974〜1978年 | GSI |
| `ort_old10` | GSI 1961〜1969年 | GSI |
| `ort_USA10` | GSI 1945〜1950年 | GSI |
| `ort_riku10` | GSI 1936〜1942年頃 | GSI |
| `ort_1928` | GSI 1928年頃（大阪） | GSI |
| `osm` | OpenStreetMap | OSM |
| `google` | Google Maps | Google |

## License

MIT
