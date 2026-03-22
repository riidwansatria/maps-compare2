import type { StyleSpecification } from 'maplibre-gl'
import { GSI_STYLES, type GsiStyleKey } from './gsi-styles'

export const BASE_SOURCE_ID = 'base-raster'
export const OVERLAY_SOURCE_ID = 'overlay-raster'
export const BASE_LAYER_ID = 'base-layer'
export const OVERLAY_LAYER_ID = 'overlay-layer'

export function buildOverlayStyle(
  baseKey: GsiStyleKey,
  overlayKey: GsiStyleKey,
  overlayOpacity: number,
): StyleSpecification {
  const baseStyle = GSI_STYLES[baseKey]
  const overlayStyle = GSI_STYLES[overlayKey]

  const baseSource = baseStyle.sources.gsi
  const overlaySource = overlayStyle.sources.gsi

  return {
    version: 8,
    sources: {
      [BASE_SOURCE_ID]: { ...baseSource },
      [OVERLAY_SOURCE_ID]: { ...overlaySource },
    },
    layers: [
      { id: BASE_LAYER_ID, type: 'raster', source: BASE_SOURCE_ID },
      {
        id: OVERLAY_LAYER_ID,
        type: 'raster',
        source: OVERLAY_SOURCE_ID,
        paint: { 'raster-opacity': overlayOpacity },
      },
    ],
  }
}
