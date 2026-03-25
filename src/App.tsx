import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Toaster, toast } from 'sonner'
import { exportMap } from '@/lib/export-map'
import { MapPane } from '@/components/MapPane'
import { OverlayMapPane } from '@/components/OverlayMapPane'
import { OpacitySlider } from '@/components/OpacitySlider'
import { DrawToolbar } from '@/components/DrawToolbar'
import { LayerSelect } from '@/components/LayerSelect'
import { AttributionBar } from '@/components/AttributionBar'
import { GeoJSONUpload, DragDropOverlay } from '@/components/GeoJSONUpload'
import { LocationSearch } from '@/components/LocationSearch'
import { useViewportSync } from '@/hooks/useViewportSync'
import { useLayerSelection } from '@/hooks/useLayerSelection'
import { useCompareMode } from '@/hooks/useCompareMode'
import { useGeoJSON } from '@/hooks/useGeoJSON'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type MapLibreGL from 'maplibre-gl'
import type { Geoman } from '@geoman-io/maplibre-geoman-free'
import type { FeatureCollection } from 'geojson'

export default function App() {
  const { viewport, onViewportChange, syncing, toggleSync } = useViewportSync()
  const { leftLayer, setLeftLayer, rightLayer, setRightLayer } =
    useLayerSelection('seamlessphoto', 'google')
  const { mode, toggleMode, overlayOpacity, setOverlayOpacity } = useCompareMode()
  const { geojsonData, filename, loadFile, clearData } = useGeoJSON()

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
      toast.success(`読み込み完了: ${file.name}`)
    } catch {
      toast.error('GeoJSONファイルの読み込みに失敗しました')
    }
  }, [loadFile])

  const handleClear = useCallback(() => {
    clearData()
    toast.info('データをクリアしました')
  }, [clearData])

  const handleExportLeft = useCallback(async () => {
    if (!leftMapRef.current) return
    try {
      await exportMap(leftMapRef.current, 'left')
      toast.success('左マップをエクスポートしました')
    } catch {
      toast.error('エクスポートに失敗しました')
    }
  }, [])

  const handleExportRight = useCallback(async () => {
    if (!rightMapRef.current) return
    try {
      await exportMap(rightMapRef.current, 'right')
      toast.success('右マップをエクスポートしました')
    } catch {
      toast.error('エクスポートに失敗しました')
    }
  }, [])

  const handleExportOverlay = useCallback(async () => {
    if (!leftMapRef.current) return
    try {
      await exportMap(leftMapRef.current, 'overlay')
      toast.success('マップをエクスポートしました')
    } catch {
      toast.error('エクスポートに失敗しました')
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('input[type="file"]')?.click()
      }
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault()
        if (!isOverlay) toggleSync()
      }
      if (e.key === 'm' && e.target === document.body) {
        e.preventDefault()
        toggleMode()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [toggleSync, toggleMode, isOverlay])

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <Toaster position="bottom-right" richColors />
      <DragDropOverlay onFileSelect={handleFileLoad} />

      <AttributionBar />

      {/* Controls bar */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4 overflow-x-auto">
        <LayerSelect
          value={leftLayer}
          onChange={setLeftLayer}
          label={isOverlay ? 'ベース' : '左'}
        />
        <Separator orientation="vertical" className="h-5" />
        <LayerSelect
          value={rightLayer}
          onChange={setRightLayer}
          label={isOverlay ? 'オーバーレイ' : '右'}
        />
        <Separator orientation="vertical" className="h-5" />

        {/* Mode toggle */}
        <Button
          variant={isOverlay ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs"
          onClick={toggleMode}
        >
          {isOverlay ? 'オーバーレイ' : '並列'}
        </Button>

        {/* Sync toggle — only in side-by-side mode */}
        {!isOverlay && (
          <Button
            variant={syncing ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs"
            onClick={toggleSync}
          >
            {syncing ? '同期オン' : '同期オフ'}
          </Button>
        )}

        <Separator orientation="vertical" className="h-5" />

        <GeoJSONUpload
          filename={filename}
          onFileSelect={handleFileLoad}
          onClear={handleClear}
        />

        <Separator orientation="vertical" className="h-5" />
        <LocationSearch onSelect={onViewportChange} />

        <Separator orientation="vertical" className="h-5" />

        {/* Export buttons */}
        {isOverlay ? (
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportOverlay}>
            エクスポート
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportLeft}>
              左をエクスポート
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportRight}>
              右をエクスポート
            </Button>
          </>
        )}

        {filename && (
          <>
            <Separator orientation="vertical" className="h-5" />
            <Badge variant="secondary" className="text-xs shrink-0">
              {filename}
            </Badge>
          </>
        )}
      </div>

      {/* Map area */}
      <div className="relative flex-1 overflow-hidden">
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
              className="h-full w-1/2"
            />
            <Separator orientation="vertical" />
            <MapPane
              onMapReady={(map) => { rightMapRef.current = map }}
              layerKey={rightLayer}
              viewport={syncing ? viewport : undefined}
              onViewportChange={syncing ? onViewportChange : undefined}
              geojsonData={geojsonData}
              showDraw
              drawPanelId="right"
              drawEditSourceRef={drawEditSourceRef}
              onGeomanReady={setRightGm}
              onDrawFeaturesChange={setDrawnFeatures}
              syncDrawFeatures={drawnFeatures}
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
  )
}
