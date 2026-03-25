import { useEffect, useRef, useState, useCallback } from 'react'
import { Geoman } from '@geoman-io/maplibre-geoman-free'
import '@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css'
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
  const gmRef = useRef<Geoman | null>(null)
  const [measurements, setMeasurements] = useState<MeasurementInfo[]>([])

  const updateMeasurements = useCallback((gm: Geoman) => {
    try {
      const fc = gm.features.exportGeoJson()
      const infos: MeasurementInfo[] = []

      for (const feature of fc.features) {
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
    } catch { /* geoman may not be ready */ }
  }, [])

  useEffect(() => {
    if (!map || !isLoaded) return

    const gm = new Geoman(map, {
      layerStyles: {
        line: {
          gm_main: [
            { type: 'line', paint: { 'line-color': DRAW_COLOR, 'line-width': 3, 'line-opacity': 1 } },
          ],
          gm_temporary: [
            { type: 'line', paint: { 'line-color': DRAW_COLOR, 'line-width': 2, 'line-opacity': 0.7 } },
          ],
        },
        polygon: {
          gm_main: [
            { type: 'fill', paint: { 'fill-color': DRAW_COLOR, 'fill-opacity': 0.4 } },
            { type: 'line', paint: { 'line-color': DRAW_COLOR, 'line-width': 2 } },
          ],
          gm_temporary: [
            { type: 'fill', paint: { 'fill-color': DRAW_COLOR, 'fill-opacity': 0.2 } },
            { type: 'line', paint: { 'line-color': DRAW_COLOR, 'line-width': 2, 'line-opacity': 0.7 } },
          ],
        },
      },
    })
    gmRef.current = gm

    const onUpdate = () => updateMeasurements(gm)

    const onLoaded = () => {
      map.on('gm:create', onUpdate)
      map.on('gm:edit', onUpdate)
      map.on('gm:drag', onUpdate)
      map.on('gm:remove', onUpdate)
    }
    map.on('gm:loaded', onLoaded)

    return () => {
      try {
        map.off('gm:loaded', onLoaded)
        map.off('gm:create', onUpdate)
        map.off('gm:edit', onUpdate)
        map.off('gm:drag', onUpdate)
        map.off('gm:remove', onUpdate)
        gm.destroy({ removeSources: true })?.catch(() => {})
      } catch { /* map may already be removed */ }
      gmRef.current = null
    }
  }, [map, isLoaded, updateMeasurements])

  return (
    <>
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
