import type { StyleSpecification } from 'maplibre-gl'

const GSI_ATTR =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">GSI Tiles</a>'

function gsiStyle(tileUrl: string, attribution?: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      gsi: {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        attribution: attribution ?? GSI_ATTR,
      },
    },
    layers: [{ id: 'gsi-layer', type: 'raster', source: 'gsi' }],
  }
}

export const GSI_STYLES = {
  // Modern maps
  standard: gsiStyle('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'),
  seamlessphoto: gsiStyle('https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'),
  pale: gsiStyle('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'),
  relief: gsiStyle('https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png'),
  landuse: gsiStyle('https://cyberjapandata.gsi.go.jp/xyz/lcm25k_2012/{z}/{x}/{y}.png'),

  // Historical aerial photos
  gazo4: gsiStyle('https://cyberjapandata.gsi.go.jp/xyz/gazo4/{z}/{x}/{y}.jpg'),
  gazo3: gsiStyle('https://cyberjapandata.gsi.go.jp/xyz/gazo3/{z}/{x}/{y}.jpg'),
  gazo2: gsiStyle('https://cyberjapandata.gsi.go.jp/xyz/gazo2/{z}/{x}/{y}.jpg'),
  gazo1: gsiStyle('https://cyberjapandata.gsi.go.jp/xyz/gazo1/{z}/{x}/{y}.jpg'),
  ort_old10: gsiStyle('https://cyberjapandata.gsi.go.jp/xyz/ort_old10/{z}/{x}/{y}.png'),
  ort_USA10: gsiStyle('https://cyberjapandata.gsi.go.jp/xyz/ort_USA10/{z}/{x}/{y}.png'),
  ort_riku10: gsiStyle('https://cyberjapandata.gsi.go.jp/xyz/ort_riku10/{z}/{x}/{y}.png'),
  ort_1928: gsiStyle('https://cyberjapandata.gsi.go.jp/xyz/ort_1928/{z}/{x}/{y}.png'),

  // Third-party
  osm: gsiStyle(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  ),
  google: gsiStyle(
    'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    '&copy; <a href="https://www.google.com/">Google</a>'
  ),
} as const

export type GsiStyleKey = keyof typeof GSI_STYLES

/** Extract tile URL from a GSI style */
export function getTileUrl(key: GsiStyleKey): string {
  const source = GSI_STYLES[key].sources.gsi as { tiles: string[] }
  return source.tiles[0]
}

/** Plain-text attribution for a given layer key */
export function getAttribution(key: GsiStyleKey): string {
  const source = GSI_STYLES[key].sources.gsi as { attribution?: string }
  const html = source.attribution ?? ''
  return html.replace(/<[^>]*>/g, '').replace(/&copy;\s*/g, '\u00A9 ')
}

/** Raw HTML attribution for a given layer key (for MapLibre attribution control) */
export function getAttributionHtml(key: GsiStyleKey): string {
  const source = GSI_STYLES[key].sources.gsi as { attribution?: string }
  return source.attribution ?? ''
}

export const LAYER_LABELS: Record<GsiStyleKey, string> = {
  standard: 'GSI Standard',
  seamlessphoto: 'GSI Photo',
  pale: 'GSI Pale',
  relief: 'GSI Relief',
  landuse: 'GSI Land Use',
  gazo4: 'GSI 1987–1990',
  gazo3: 'GSI 1984–1986',
  gazo2: 'GSI 1979–1983',
  gazo1: 'GSI 1974–1978',
  ort_old10: 'GSI 1961–1969',
  ort_USA10: 'GSI 1945–1950',
  ort_riku10: 'GSI c. 1936–1942',
  ort_1928: 'GSI c. 1928 (Osaka)',
  osm: 'OpenStreetMap',
  google: 'Google Maps',
}
