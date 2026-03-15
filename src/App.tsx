import { useRef, useEffect, useCallback } from 'react'
import { Toaster, toast } from 'sonner'
import { GSI_STYLES } from '@/lib/gsi-styles'
import { exportMap } from '@/lib/export-map'
import { MapPane } from '@/components/MapPane'
import { LayerSelect } from '@/components/LayerSelect'
import { AttributionBar } from '@/components/AttributionBar'
import { GeoJSONUpload, DragDropOverlay } from '@/components/GeoJSONUpload'
import { LocationSearch } from '@/components/LocationSearch'
import { useViewportSync } from '@/hooks/useViewportSync'
import { useLayerSelection } from '@/hooks/useLayerSelection'
import { useGeoJSON } from '@/hooks/useGeoJSON'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type MapLibreGL from 'maplibre-gl'

export default function App() {
  const { viewport, onViewportChange, syncing, toggleSync } = useViewportSync()
  const { leftLayer, setLeftLayer, rightLayer, setRightLayer } =
    useLayerSelection('seamlessphoto', 'google')
  const { geojsonData, filename, loadFile, clearData } = useGeoJSON()

  const leftMapRef = useRef<MapLibreGL.Map | null>(null)
  const rightMapRef = useRef<MapLibreGL.Map | null>(null)

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

  // No-op callback so the right map enters controlled mode when syncing
  const noop = useCallback(() => {}, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('input[type="file"]')?.click()
      }
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault()
        toggleSync()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [toggleSync])

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <Toaster position="bottom-right" richColors />
      <DragDropOverlay onFileSelect={handleFileLoad} />

      <AttributionBar />

      {/* Controls bar */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4 overflow-x-auto">
        <LayerSelect value={leftLayer} onChange={setLeftLayer} label="左" />
        <Separator orientation="vertical" className="h-5" />
        <LayerSelect value={rightLayer} onChange={setRightLayer} label="右" />
        <Separator orientation="vertical" className="h-5" />

        {/* Sync toggle */}
        <Button
          variant={syncing ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs"
          onClick={toggleSync}
        >
          {syncing ? '同期オン' : '同期オフ'}
        </Button>

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
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportLeft}>
          左をエクスポート
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportRight}>
          右をエクスポート
        </Button>

        {filename && (
          <>
            <Separator orientation="vertical" className="h-5" />
            <Badge variant="secondary" className="text-xs shrink-0">
              {filename}
            </Badge>
          </>
        )}
      </div>

      {/* Dual map */}
      <div className="flex flex-1 overflow-hidden">
        <MapPane
          onMapReady={(map) => { leftMapRef.current = map }}
          mapStyle={GSI_STYLES[leftLayer]}
          viewport={viewport}
          onViewportChange={onViewportChange}
          geojsonData={geojsonData}
          showDraw
          className="h-full w-1/2"
        />
        <Separator orientation="vertical" />
        <MapPane
          onMapReady={(map) => { rightMapRef.current = map }}
          mapStyle={GSI_STYLES[rightLayer]}
          viewport={syncing ? viewport : undefined}
          onViewportChange={syncing ? noop : undefined}
          geojsonData={geojsonData}
          className="h-full w-1/2"
        />
      </div>
    </div>
  )
}
