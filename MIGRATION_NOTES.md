# Migration Notes — maps-compare2

## Codebase Summary (Pre-Migration)

### Map Initialization
- Two Leaflet maps in `#mapcontainer1` and `#mapcontainer2`
- Center: `[35.703640, 139.747635]` (Tokyo area)
- Zoom: 11, zoomSnap: 0.1, zoomDelta: 0.25
- Left default layer: "GSI Seamless Photo"
- Right default layer: "Google Maps"

### Map Sync
- Event-based: `map1.on('move zoomend')` syncs to map2 and vice versa
- Togglable via `syncing` boolean flag
- Uses `setView(center, zoom, { animate: false })`

### GSI Tile Layer URLs (from src/data/layers.js)
1. GSI Standard: `https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png`
2. GSI Seamless Photo: `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg`
3. GSI Pale: `https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png`
4. GSI Relief: `https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png`
5. GSI Land Use: `https://cyberjapandata.gsi.go.jp/xyz/lcm25k_2012/{z}/{x}/{y}.png`
6. GSI 1987-1990: `https://cyberjapandata.gsi.go.jp/xyz/gazo4/{z}/{x}/{y}.jpg`
7. GSI 1984-1986: `https://cyberjapandata.gsi.go.jp/xyz/gazo3/{z}/{x}/{y}.jpg`
8. GSI 1979-1983: `https://cyberjapandata.gsi.go.jp/xyz/gazo2/{z}/{x}/{y}.jpg`
9. GSI 1974-1978: `https://cyberjapandata.gsi.go.jp/xyz/gazo1/{z}/{x}/{y}.jpg`
10. GSI 1961-1969: `https://cyberjapandata.gsi.go.jp/xyz/ort_old10/{z}/{x}/{y}.png`
11. GSI 1945-1950: `https://cyberjapandata.gsi.go.jp/xyz/ort_USA10/{z}/{x}/{y}.png`
12. GSI 1936-1942: `https://cyberjapandata.gsi.go.jp/xyz/ort_riku10/{z}/{x}/{y}.png`
13. GSI 1928 (Osaka): `https://cyberjapandata.gsi.go.jp/xyz/ort_1928/{z}/{x}/{y}.png`
14. CartoDB Positron: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`
15. OpenStreetMap: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
16. Google Maps: `https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}`

Note: CartoDB/OSM use `{s}` subdomains which MapLibre handles differently — need `['a','b','c']` in tiles array or single URL without `{s}`.

### GeoJSON Handling
- Loaded via file upload or drag-and-drop
- Stored in localStorage (with sessionStorage fallback)
- Displayed on BOTH maps simultaneously
- No pre-bundled GeoJSON files

### Custom Controls
- Scale bar (Leaflet built-in, bottomleft)
- Scale selector (custom, bottomright) — maps zoom to predefined scales
- Compass (leaflet-compass, topright)
- Geocoder (leaflet-control-geocoder, map1 only)
- Geoman (drawing/measurement: polyline, polygon, rectangle)
- Layer control (Leaflet built-in, topleft)
- Map export (snapdom with html2canvas fallback)

### State Managed
- Sync toggle (on/off)
- Selected tile layers per map (via Leaflet layer control)
- GeoJSON data + filename (localStorage)
- Drawing layers (Geoman, in-memory)
- User location marker

### Key Decisions for Migration
- Google Maps tiles may have CORS issues in MapLibre — keep but note limitation
- CartoDB/OSM `{s}` subdomain pattern needs conversion for MapLibre
- Geoman drawing tools have no direct MapLibre equivalent — will need @mapbox/mapbox-gl-draw or similar
- Map export via snapdom/html2canvas can remain library-agnostic
