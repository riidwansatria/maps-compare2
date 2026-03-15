import { useEffect, useRef, useState, useCallback } from 'react'
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  TerraDrawRenderMode,
} from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import { useMap } from '@/components/ui/map'
import type { Position } from 'geojson'

/** Calculate geodesic distance between two points in meters */
function haversineDistance(a: Position, b: Position): number {
  const R = 6378137
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLon = ((b[0] - a[0]) * Math.PI) / 180
  const lat1 = (a[1] * Math.PI) / 180
  const lat2 = (b[1] * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function lineLength(coords: Position[]): number {
  let total = 0
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversineDistance(coords[i], coords[i + 1])
  }
  return total
}

function polygonArea(coords: Position[]): number {
  const R = 6378137
  let area = 0
  const n = coords.length
  for (let i = 0; i < n; i++) {
    const p1 = coords[i]
    const p2 = coords[(i + 1) % n]
    area +=
      ((p2[0] - p1[0]) * Math.PI) / 180 *
      (2 + Math.sin((p1[1] * Math.PI) / 180) + Math.sin((p2[1] * Math.PI) / 180))
  }
  return Math.abs((area * R * R) / 2)
}

function formatDistance(m: number): string {
  return m > 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(2)} m`
}

function formatArea(m2: number): string {
  return m2 > 10000 ? `${(m2 / 10000).toFixed(2)} ha` : `${m2.toFixed(2)} m²`
}

interface MeasurementInfo {
  id: string
  text: string
}

const DRAW_COLOR = '#db4a37'

export function DrawControl() {
  const { map, isLoaded } = useMap()
  const drawRef = useRef<TerraDraw | null>(null)
  const [measurements, setMeasurements] = useState<MeasurementInfo[]>([])
  const [activeMode, setActiveMode] = useState<string | null>(null)

  const updateMeasurements = useCallback((draw: TerraDraw) => {
    const snapshot = draw.getSnapshot()
    const infos: MeasurementInfo[] = []

    for (const feature of snapshot) {
      if (!feature.geometry || !feature.id) continue

      if (feature.geometry.type === 'LineString') {
        const coords = feature.geometry.coordinates
        const text = `距離: ${formatDistance(lineLength(coords))}`
        infos.push({ id: String(feature.id), text })
      }

      if (feature.geometry.type === 'Polygon') {
        const ring = feature.geometry.coordinates[0]
        const perim = lineLength(ring)
        const area = polygonArea(ring)
        const text = `周囲: ${formatDistance(perim)} / 面積: ${formatArea(area)}`
        infos.push({ id: String(feature.id), text })
      }
    }
    setMeasurements(infos)
  }, [])

  useEffect(() => {
    if (!map || !isLoaded) return

    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map, coordinatePrecision: 9 }),
      modes: [
        new TerraDrawLineStringMode({
          styles: {
            lineStringColor: DRAW_COLOR,
            lineStringWidth: 3,
          },
        }),
        new TerraDrawPolygonMode({
          styles: {
            fillColor: DRAW_COLOR,
            fillOpacity: 0.4,
            outlineColor: DRAW_COLOR,
            outlineWidth: 2,
          },
        }),
        new TerraDrawSelectMode({
          flags: {
            linestring: {
              feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } },
            },
            polygon: {
              feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } },
            },
          },
        }),
        new TerraDrawRenderMode({ modeName: 'static', styles: {} }),
      ],
    })

    draw.start()
    drawRef.current = draw

    // Listen for changes
    const onChange = () => updateMeasurements(draw)
    draw.on('change', onChange)
    draw.on('finish', onChange)

    return () => {
      draw.off('change', onChange)
      draw.off('finish', onChange)
      draw.stop()
      drawRef.current = null
    }
  }, [map, isLoaded, updateMeasurements])

  const setMode = useCallback((mode: string) => {
    if (!drawRef.current) return
    drawRef.current.setMode(mode)
    setActiveMode(mode)
  }, [])

  const handleClearAll = useCallback(() => {
    if (!drawRef.current) return
    drawRef.current.clear()
    setMeasurements([])
  }, [])

  return (
    <>
      {/* Draw toolbar */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        <button
          className={`rounded px-2 py-1 text-xs shadow border ${activeMode === 'linestring' ? 'bg-primary text-primary-foreground' : 'bg-background/90'}`}
          onClick={() => setMode('linestring')}
          title="線を描く"
        >
          ╱ 線
        </button>
        <button
          className={`rounded px-2 py-1 text-xs shadow border ${activeMode === 'polygon' ? 'bg-primary text-primary-foreground' : 'bg-background/90'}`}
          onClick={() => setMode('polygon')}
          title="ポリゴンを描く"
        >
          ▭ 面
        </button>
        <button
          className={`rounded px-2 py-1 text-xs shadow border ${activeMode === 'select' ? 'bg-primary text-primary-foreground' : 'bg-background/90'}`}
          onClick={() => setMode('select')}
          title="選択"
        >
          ↖ 選択
        </button>
        <button
          className="rounded px-2 py-1 text-xs shadow border bg-background/90 text-destructive"
          onClick={handleClearAll}
          title="全削除"
        >
          ✕ 削除
        </button>
      </div>

      {/* Measurements display */}
      {measurements.length > 0 && (
        <div className="absolute bottom-8 left-2 z-10 max-w-xs space-y-1">
          {measurements.map((m) => (
            <div
              key={m.id}
              className="rounded bg-background/90 px-2 py-1 text-xs shadow border"
            >
              {m.text}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
