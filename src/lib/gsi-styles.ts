import type { StyleSpecification } from 'maplibre-gl'

const GSI_ATTR =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>'

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

export const LAYER_LABELS: Record<GsiStyleKey, string> = {
  standard: 'GSI 標準地図',
  seamlessphoto: 'GSI 写真',
  pale: 'GSI 淡色地図',
  relief: 'GSI 陰影起伏図',
  landuse: 'GSI 土地利用図',
  gazo4: 'GSI 1987〜1990年',
  gazo3: 'GSI 1984〜1986年',
  gazo2: 'GSI 1979〜1983年',
  gazo1: 'GSI 1974〜1978年',
  ort_old10: 'GSI 1961〜1969年',
  ort_USA10: 'GSI 1945〜1950年',
  ort_riku10: 'GSI 1936〜1942年頃',
  ort_1928: 'GSI 1928年頃（大阪）',
  osm: 'OpenStreetMap',
  google: 'Google Maps',
}
