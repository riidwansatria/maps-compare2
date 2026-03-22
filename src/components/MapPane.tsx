import { useEffect, useRef } from 'react'
import MapLibreGL from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
import type { GeoJSON } from 'geojson'
import { Map, useMap, MapControls } from '@/components/ui/map'
import { DrawControl } from '@/components/DrawControl'
import type { Viewport } from '@/hooks/useViewportSync'

interface MapPaneProps {
  mapStyle: StyleSpecification
  viewport?: Viewport
  onViewportChange?: (viewport: Viewport) => void
  onMapReady?: (map: MapLibreGL.Map) => void
  geojsonData?: GeoJSON | null
  showDraw?: boolean
  className?: string
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
  mapStyle, viewport, onViewportChange, onMapReady, geojsonData, showDraw, className,
}: MapPaneProps) {
  return (
    <Map
      styles={{ light: mapStyle, dark: mapStyle }}
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
      {showDraw && <DrawControl />}
      <GeoJSONLayer data={geojsonData} />
      {onMapReady && <MapReadyBridge onMapReady={onMapReady} />}
    </Map>
  )
}
