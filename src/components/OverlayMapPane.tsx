import { useEffect, useRef, useMemo } from 'react'
import MapLibreGL from 'maplibre-gl'
import type { GeoJSON, FeatureCollection } from 'geojson'
import type { Geoman } from '@geoman-io/maplibre-geoman-free'
import { Map, useMap, MapControls } from '@/components/ui/map'
import { DrawControl } from '@/components/DrawControl'
import { GeoJSONLayer, ScaleControl, MapReadyBridge } from '@/components/MapPane'
import { buildOverlayStyle, BASE_SOURCE_ID, OVERLAY_SOURCE_ID, BASE_LAYER_ID, OVERLAY_LAYER_ID } from '@/lib/overlay-style'
import { GSI_STYLES, type GsiStyleKey } from '@/lib/gsi-styles'
import type { Viewport } from '@/hooks/useViewportSync'

interface OverlayMapPaneProps {
  baseLayer: GsiStyleKey
  overlayLayer: GsiStyleKey
  overlayOpacity: number
  viewport: Viewport
  onViewportChange: (viewport: Viewport) => void
  onMapReady?: (map: MapLibreGL.Map) => void
  geojsonData?: GeoJSON | null
  showDraw?: boolean
  drawPanelId?: string
  drawEditSourceRef?: React.MutableRefObject<string | null>
  onGeomanReady?: (gm: Geoman | null) => void
  onDrawFeaturesChange?: (fc: FeatureCollection) => void
  className?: string
}

function OverlayLayerManager({
  baseLayer,
  overlayLayer,
  overlayOpacity,
}: {
  baseLayer: GsiStyleKey
  overlayLayer: GsiStyleKey
  overlayOpacity: number
}) {
  const { map, isLoaded } = useMap()
  const prevBaseRef = useRef(baseLayer)
  const prevOverlayRef = useRef(overlayLayer)

  // Handle base layer changes
  useEffect(() => {
    if (!map || !isLoaded) return
    if (prevBaseRef.current === baseLayer) return

    const doSwap = () => {
      try {
        if (map.getLayer(BASE_LAYER_ID)) map.removeLayer(BASE_LAYER_ID)
        if (map.getSource(BASE_SOURCE_ID)) map.removeSource(BASE_SOURCE_ID)

        const source = GSI_STYLES[baseLayer].sources.gsi
        map.addSource(BASE_SOURCE_ID, { ...source })
        map.addLayer(
          { id: BASE_LAYER_ID, type: 'raster', source: BASE_SOURCE_ID },
          OVERLAY_LAYER_ID,
        )
        prevBaseRef.current = baseLayer
      } catch {
        // style may not be ready yet
      }
    }

    if (map.isStyleLoaded()) doSwap()
    else map.once('styledata', () => setTimeout(doSwap, 100))
  }, [map, isLoaded, baseLayer])

  // Handle overlay layer changes
  useEffect(() => {
    if (!map || !isLoaded) return
    if (prevOverlayRef.current === overlayLayer) return

    const doSwap = () => {
      try {
        if (map.getLayer(OVERLAY_LAYER_ID)) map.removeLayer(OVERLAY_LAYER_ID)
        if (map.getSource(OVERLAY_SOURCE_ID)) map.removeSource(OVERLAY_SOURCE_ID)

        const source = GSI_STYLES[overlayLayer].sources.gsi
        map.addSource(OVERLAY_SOURCE_ID, { ...source })
        map.addLayer({
          id: OVERLAY_LAYER_ID,
          type: 'raster',
          source: OVERLAY_SOURCE_ID,
          paint: { 'raster-opacity': overlayOpacity },
        })
        prevOverlayRef.current = overlayLayer
      } catch {
        // style may not be ready yet
      }
    }

    if (map.isStyleLoaded()) doSwap()
    else map.once('styledata', () => setTimeout(doSwap, 100))
  }, [map, isLoaded, overlayLayer, overlayOpacity])

  // Handle opacity changes
  useEffect(() => {
    if (!map || !isLoaded) return
    try {
      if (map.getLayer(OVERLAY_LAYER_ID)) {
        map.setPaintProperty(OVERLAY_LAYER_ID, 'raster-opacity', overlayOpacity)
      }
    } catch {
      // layer may not exist yet
    }
  }, [map, isLoaded, overlayOpacity])

  return null
}

export function OverlayMapPane({
  baseLayer,
  overlayLayer,
  overlayOpacity,
  viewport,
  onViewportChange,
  onMapReady,
  geojsonData,
  showDraw,
  drawPanelId,
  drawEditSourceRef,
  onGeomanReady,
  onDrawFeaturesChange,
  className,
}: OverlayMapPaneProps) {
  const initialStyle = useMemo(
    () => buildOverlayStyle(baseLayer, overlayLayer, overlayOpacity),
    // Only use initial values for the style — runtime changes go through OverlayLayerManager
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <Map
      styles={{ light: initialStyle, dark: initialStyle }}
      viewport={viewport}
      onViewportChange={onViewportChange}
      // @ts-expect-error — MapLibre supports preserveDrawingBuffer but mapcn types don't expose it
      preserveDrawingBuffer={true}
      className={className}
    >
      <MapControls position="top-right" showZoom showCompass showLocate />
      <ScaleControl />
      {showDraw && drawPanelId && drawEditSourceRef && (
        <DrawControl
          panelId={drawPanelId}
          editSourceRef={drawEditSourceRef}
          onGeomanReady={onGeomanReady}
          onFeaturesChange={onDrawFeaturesChange}
        />
      )}
      <GeoJSONLayer data={geojsonData} />
      <OverlayLayerManager
        baseLayer={baseLayer}
        overlayLayer={overlayLayer}
        overlayOpacity={overlayOpacity}
      />
      {onMapReady && <MapReadyBridge onMapReady={onMapReady} />}
    </Map>
  )
}
