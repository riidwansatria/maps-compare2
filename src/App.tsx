import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Agentation } from 'agentation'
import { Toaster, toast } from 'sonner'
import { exportMap } from '@/lib/export-map'
import { MapPane } from '@/components/MapPane'
import { OverlayMapPane } from '@/components/OverlayMapPane'
import { OpacitySlider } from '@/components/OpacitySlider'
import { DrawToolbar } from '@/components/DrawToolbar'
import { LayerSelect } from '@/components/LayerSelect'
import { Navbar } from '@/components/AttributionBar'
import { /* GeoJSONUpload, */ DragDropOverlay } from '@/components/GeoJSONUpload'
import { LocationSearch } from '@/components/LocationSearch'
import { useViewportSync } from '@/hooks/useViewportSync'
import { useLayerSelection } from '@/hooks/useLayerSelection'
import { useCompareMode } from '@/hooks/useCompareMode'
import { useGeoJSON } from '@/hooks/useGeoJSON'
import { Separator } from '@/components/ui/separator'
// import { Button } from '@/components/ui/button'
// import { Badge } from '@/components/ui/badge'
import type MapLibreGL from 'maplibre-gl'
import type { Geoman } from '@geoman-io/maplibre-geoman-free'
import type { FeatureCollection } from 'geojson'

export default function App() {
  const { viewport, onViewportChange } = useViewportSync()
  const { leftLayer, setLeftLayer, rightLayer, setRightLayer } =
    useLayerSelection('seamlessphoto', 'google')
  const { mode, toggleMode, overlayOpacity, setOverlayOpacity } = useCompareMode()
  const { geojsonData, /* filename, */ loadFile, clearData } = useGeoJSON()

  const leftMapRef = useRef<MapLibreGL.Map | null>(null)
  const rightMapRef = useRef<MapLibreGL.Map | null>(null)

  // Geoman instances for the toolbar to control
  const [leftGm, setLeftGm] = useState<Geoman | null>(null)
  const [rightGm, setRightGm] = useState<Geoman | null>(null)

  // Single canonical drawn features + source tracking to prevent sync loops
  const [drawnFeatures, setDrawnFeatures] = useState<FeatureCollection | null>(null)
  const drawEditSourceRef = useRef<string | null>(null)

  const isOverlay = mode === 'overlay'

  // Collect all active Geoman instances for the toolbar
  const geomanInstances = useMemo(() => {
    if (isOverlay) return [leftGm].filter(Boolean) as Geoman[]
    return [leftGm, rightGm].filter(Boolean) as Geoman[]
  }, [isOverlay, leftGm, rightGm])

  // Use drawnFeatures as the canonical source for measurements
  const currentFeatures = drawnFeatures

  // Wrap loadFile with toast feedback
  const handleFileLoad = useCallback(async (file: File) => {
    try {
      await loadFile(file)
      toast.success(`Loaded: ${file.name}`)
    } catch {
      toast.error('Failed to load GeoJSON file')
    }
  }, [loadFile])

  // kept for future use
  void clearData
  void exportMap
  // const handleClear = useCallback(() => {
  //   clearData()
  //   toast.info('Data cleared')
  // }, [clearData])
  // const handleExportLeft = useCallback(async () => { ... }, [])
  // const handleExportRight = useCallback(async () => { ... }, [])
  // const handleExportOverlay = useCallback(async () => { ... }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('input[type="file"]')?.click()
      }
      if (e.key === 'm' && e.target === document.body) {
        e.preventDefault()
        toggleMode()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [toggleMode])

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <Toaster position="bottom-right" richColors />
      <Agentation />
      <DragDropOverlay onFileSelect={handleFileLoad} />

      {/* Navbar */}
      <Navbar mode={mode} onToggleMode={toggleMode}>
        <LayerSelect
          value={leftLayer}
          onChange={setLeftLayer}
          label={isOverlay ? 'Base' : 'Left'}
        />
        <Separator orientation="vertical" className="h-5" />
        <LayerSelect
          value={rightLayer}
          onChange={setRightLayer}
          label={isOverlay ? 'Overlay' : 'Right'}
        />
        <div className="flex-1" />
        <LocationSearch onSelect={onViewportChange} />
      </Navbar>

      {/* Map area — inset frame */}
      <div className="relative flex-1 overflow-hidden bg-background px-2 pb-2">
        <div className="map-frame relative h-full overflow-hidden border">
        {isOverlay ? (
          <>
            <OverlayMapPane
              baseLayer={leftLayer}
              overlayLayer={rightLayer}
              overlayOpacity={overlayOpacity}
              viewport={viewport}
              onViewportChange={onViewportChange}
              onMapReady={(map) => {
                leftMapRef.current = map
                rightMapRef.current = map
              }}
              geojsonData={geojsonData}
              showDraw
              drawPanelId="overlay"
              drawEditSourceRef={drawEditSourceRef}
              onGeomanReady={setLeftGm}
              onDrawFeaturesChange={setDrawnFeatures}
              syncDrawFeatures={drawnFeatures}
              className="h-full w-full"
            />
            <OpacitySlider
              value={overlayOpacity}
              onChange={setOverlayOpacity}
              baseLayer={leftLayer}
              overlayLayer={rightLayer}
            />
          </>
        ) : (
          <div className="flex h-full">
            <MapPane
              onMapReady={(map) => { leftMapRef.current = map }}
              layerKey={leftLayer}
              viewport={viewport}
              onViewportChange={onViewportChange}
              geojsonData={geojsonData}
              showDraw
              drawPanelId="left"
              drawEditSourceRef={drawEditSourceRef}
              onGeomanReady={setLeftGm}
              onDrawFeaturesChange={setDrawnFeatures}
              syncDrawFeatures={drawnFeatures}
              showControls={false}
              className="h-full w-1/2"
            />
            <Separator orientation="vertical" />
            <MapPane
              onMapReady={(map) => { rightMapRef.current = map }}
              layerKey={rightLayer}
              viewport={viewport}
              onViewportChange={onViewportChange}
              geojsonData={geojsonData}
              showDraw
              drawPanelId="right"
              drawEditSourceRef={drawEditSourceRef}
              onGeomanReady={setRightGm}
              onDrawFeaturesChange={setDrawnFeatures}
              syncDrawFeatures={drawnFeatures}
              showScale={false}
              extraAttribution={leftLayer}
              className="h-full w-1/2"
            />
          </div>
        )}

        {/* Draw toolbar — floating over both maps */}
        <DrawToolbar
          geomanInstances={geomanInstances}
          features={currentFeatures}
        />

        </div>
      </div>
    </div>
  )
}
