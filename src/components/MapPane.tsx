import { useEffect, useRef, useMemo } from 'react'
import MapLibreGL from 'maplibre-gl'
import type { GeoJSON, FeatureCollection } from 'geojson'
import type { Geoman } from '@geoman-io/maplibre-geoman-free'
import { Map, useMap, MapControls } from '@/components/ui/map'
import { DrawControl } from '@/components/DrawControl'
import { GSI_STYLES, getTileUrl, type GsiStyleKey } from '@/lib/gsi-styles'
import type { Viewport } from '@/hooks/useViewportSync'

const TILE_SOURCE_ID = 'gsi'

interface MapPaneProps {
  layerKey: GsiStyleKey
  viewport?: Viewport
  onViewportChange?: (viewport: Viewport) => void
  onMapReady?: (map: MapLibreGL.Map) => void
  geojsonData?: GeoJSON | null
  showDraw?: boolean
  drawPanelId?: string
  drawEditSourceRef?: React.MutableRefObject<string | null>
  onGeomanReady?: (gm: Geoman | null) => void
  onDrawFeaturesChange?: (fc: FeatureCollection) => void
  syncDrawFeatures?: FeatureCollection | null
  className?: string
}

/**
 * Swaps the raster tile URL without replacing the entire style.
 * This preserves all other sources/layers (Geoman, GeoJSON, etc.)
 */
function TileLayerSwapper({ layerKey }: { layerKey: GsiStyleKey }) {
  const { map, isLoaded } = useMap()
  const prevKeyRef = useRef(layerKey)

  useEffect(() => {
    if (!map || !isLoaded) return
    if (prevKeyRef.current === layerKey) return
    prevKeyRef.current = layerKey

    try {
      const source = map.getSource(TILE_SOURCE_ID) as MapLibreGL.RasterTileSource | undefined
      if (source) {
        // Update tiles on the existing source — no style replacement needed
        source.setTiles([getTileUrl(layerKey)])
      }
    } catch { /* source may not exist yet */ }
  }, [map, isLoaded, layerKey])

  return null
}

const GEOJSON_SOURCE_ID = 'user-geojson'
const GEOJSON_FILL_LAYER = 'user-geojson-fill'
const GEOJSON_LINE_LAYER = 'user-geojson-line'
const GEOJSON_POINT_LAYER = 'user-geojson-point'

function addGeoJSONLayers(map: MapLibreGL.Map, data: GeoJSON) {
  for (const layerId of [GEOJSON_FILL_LAYER, GEOJSON_LINE_LAYER, GEOJSON_POINT_LAYER]) {
    if (map.getLayer(layerId)) map.removeLayer(layerId)
  }
  if (map.getSource(GEOJSON_SOURCE_ID)) map.removeSource(GEOJSON_SOURCE_ID)

  map.addSource(GEOJSON_SOURCE_ID, { type: 'geojson', data })

  map.addLayer({
    id: GEOJSON_FILL_LAYER,
    type: 'fill',
    source: GEOJSON_SOURCE_ID,
    filter: ['==', '$type', 'Polygon'],
    paint: { 'fill-color': '#db4a37', 'fill-opacity': 0.4 },
  })

  map.addLayer({
    id: GEOJSON_LINE_LAYER,
    type: 'line',
    source: GEOJSON_SOURCE_ID,
    filter: ['any', ['==', '$type', 'LineString'], ['==', '$type', 'Polygon']],
    paint: { 'line-color': '#db4a37', 'line-width': 2 },
  })

  map.addLayer({
    id: GEOJSON_POINT_LAYER,
    type: 'circle',
    source: GEOJSON_SOURCE_ID,
    filter: ['==', '$type', 'Point'],
    paint: {
      'circle-radius': 6,
      'circle-color': '#db4a37',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  })
}

function removeGeoJSONLayers(map: MapLibreGL.Map) {
  for (const layerId of [GEOJSON_FILL_LAYER, GEOJSON_LINE_LAYER, GEOJSON_POINT_LAYER]) {
    if (map.getLayer(layerId)) map.removeLayer(layerId)
  }
  if (map.getSource(GEOJSON_SOURCE_ID)) map.removeSource(GEOJSON_SOURCE_ID)
}

export function GeoJSONLayer({ data }: { data: GeoJSON | null | undefined }) {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return

    const applyGeoJSON = () => {
      if (data) {
        addGeoJSONLayers(map, data)
      } else {
        removeGeoJSONLayers(map)
      }
    }

    if (map.isStyleLoaded()) {
      applyGeoJSON()
    } else {
      map.once('styledata', () => setTimeout(applyGeoJSON, 200))
    }

    const onStyleData = () => {
      if (data) {
        setTimeout(() => {
          if (map.isStyleLoaded() && data) {
            addGeoJSONLayers(map, data)
          }
        }, 200)
      }
    }
    map.on('styledata', onStyleData)

    return () => {
      try { map.off('styledata', onStyleData) } catch { /* map may already be removed */ }
    }
  }, [map, isLoaded, data])

  return null
}

/** Adds the native MapLibre scale control */
export function ScaleControl() {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return
    const scale = new MapLibreGL.ScaleControl({ maxWidth: 200, unit: 'metric' })
    map.addControl(scale, 'bottom-left')
    return () => {
      try { map.removeControl(scale) } catch { /* map may already be removed */ }
    }
  }, [map, isLoaded])

  return null
}

/** Calls onMapReady with the underlying MapLibre instance */
export function MapReadyBridge({ onMapReady }: { onMapReady: (map: MapLibreGL.Map) => void }) {
  const { map, isLoaded } = useMap()
  const calledRef = useRef(false)

  useEffect(() => {
    if (map && isLoaded && !calledRef.current) {
      calledRef.current = true
      onMapReady(map)
    }
  }, [map, isLoaded, onMapReady])

  return null
}

export function MapPane({
  layerKey, viewport, onViewportChange, onMapReady, geojsonData,
  showDraw, drawPanelId, drawEditSourceRef, onGeomanReady, onDrawFeaturesChange, syncDrawFeatures,
  className,
}: MapPaneProps) {
  // Stable initial style — never changes, so mapcn won't call setStyle()
  const initialStyle = useMemo(() => GSI_STYLES[layerKey], []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Map
      styles={{ light: initialStyle, dark: initialStyle }}
      viewport={viewport}
      onViewportChange={onViewportChange}
      // @ts-expect-error — MapLibre supports preserveDrawingBuffer but mapcn types don't expose it
      preserveDrawingBuffer={true}
      className={className}
    >
      <MapControls
        position="top-right"
        showZoom
        showCompass
        showLocate
      />
      <ScaleControl />
      <TileLayerSwapper layerKey={layerKey} />
      {showDraw && drawPanelId && drawEditSourceRef && (
        <DrawControl
          panelId={drawPanelId}
          editSourceRef={drawEditSourceRef}
          onGeomanReady={onGeomanReady}
          onFeaturesChange={onDrawFeaturesChange}
          syncFeatures={syncDrawFeatures}
        />
      )}
      <GeoJSONLayer data={geojsonData} />
      {onMapReady && <MapReadyBridge onMapReady={onMapReady} />}
    </Map>
  )
}
