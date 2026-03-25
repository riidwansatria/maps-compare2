import { useState, useCallback } from 'react'
import type { Geoman } from '@geoman-io/maplibre-geoman-free'
import type { Position, FeatureCollection } from 'geojson'
import { Button } from '@/components/ui/button'

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

function computeMeasurements(fc: FeatureCollection): string[] {
  const results: string[] = []
  for (const feature of fc.features) {
    if (!feature.geometry) continue
    if (feature.geometry.type === 'LineString') {
      results.push(`距離: ${formatDistance(lineLength(feature.geometry.coordinates))}`)
    }
    if (feature.geometry.type === 'Polygon') {
      const ring = feature.geometry.coordinates[0]
      results.push(`周囲: ${formatDistance(lineLength(ring))} / 面積: ${formatArea(polygonArea(ring))}`)
    }
  }
  return results
}

type DrawMode = 'marker' | 'line' | 'polygon' | 'circle' | 'rectangle' | 'edit' | null

interface DrawToolbarProps {
  geomanInstances: (Geoman | null)[]
  features: FeatureCollection | null
}

export function DrawToolbar({ geomanInstances, features }: DrawToolbarProps) {
  const [activeMode, setActiveMode] = useState<DrawMode>(null)

  const activateMode = useCallback(async (mode: DrawMode) => {
    for (const gm of geomanInstances) {
      if (!gm) continue
      try {
        await gm.disableAllModes()
        if (mode === 'edit') {
          await gm.enableGlobalEditMode()
        } else if (mode) {
          await gm.enableDraw(mode)
        }
      } catch { /* instance may not be ready */ }
    }
    setActiveMode(mode)
  }, [geomanInstances])

  const clearAll = useCallback(async () => {
    for (const gm of geomanInstances) {
      if (!gm) continue
      try {
        await gm.disableAllModes()
        await gm.features.deleteAll()
      } catch { /* instance may not be ready */ }
    }
    setActiveMode(null)
  }, [geomanInstances])

  const measurements = features ? computeMeasurements(features) : []

  const tools: { mode: DrawMode; label: string }[] = [
    { mode: 'marker', label: 'ピン' },
    { mode: 'line', label: '線' },
    { mode: 'polygon', label: '面' },
    { mode: 'circle', label: '円' },
    { mode: 'rectangle', label: '四角' },
    { mode: 'edit', label: '編集' },
  ]

  return (
    <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 flex items-center gap-1.5 rounded-lg border bg-background/95 px-2 py-1.5 shadow-lg backdrop-blur-sm select-none">
      {tools.map(({ mode, label }) => (
        <Button
          key={mode}
          variant={activeMode === mode ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => activateMode(activeMode === mode ? null : mode)}
        >
          {label}
        </Button>
      ))}
      <div className="mx-0.5 h-4 w-px bg-border" />
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2.5 text-xs text-destructive hover:text-destructive"
        onClick={clearAll}
      >
        削除
      </Button>
      {measurements.length > 0 && (
        <>
          <div className="mx-0.5 h-4 w-px bg-border" />
          {measurements.map((m, i) => (
            <span key={i} className="text-xs text-muted-foreground whitespace-nowrap">
              {m}
            </span>
          ))}
        </>
      )}
    </div>
  )
}
