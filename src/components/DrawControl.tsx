import { useEffect, useRef, useCallback, useState } from 'react'
import { Geoman } from '@geoman-io/maplibre-geoman-free'
import '@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css'
import { useMap } from '@/components/ui/map'
import type { FeatureCollection } from 'geojson'

const DRAW_COLOR = '#db4a37'

const LAYER_STYLES = {
  line: {
    gm_main: [
      { type: 'line' as const, paint: { 'line-color': DRAW_COLOR, 'line-width': 3, 'line-opacity': 1 } },
    ],
    gm_temporary: [
      { type: 'line' as const, paint: { 'line-color': DRAW_COLOR, 'line-width': 2, 'line-opacity': 0.7 } },
    ],
  },
  polygon: {
    gm_main: [
      { type: 'fill' as const, paint: { 'fill-color': DRAW_COLOR, 'fill-opacity': 0.4 } },
      { type: 'line' as const, paint: { 'line-color': DRAW_COLOR, 'line-width': 2 } },
    ],
    gm_temporary: [
      { type: 'fill' as const, paint: { 'fill-color': DRAW_COLOR, 'fill-opacity': 0.2 } },
      { type: 'line' as const, paint: { 'line-color': DRAW_COLOR, 'line-width': 2, 'line-opacity': 0.7 } },
    ],
  },
}

interface DrawControlProps {
  /** Unique identifier for this panel ('left', 'right', 'overlay') */
  panelId: string
  /** Ref tracking which panel last edited features — set synchronously before setState */
  editSourceRef: React.MutableRefObject<string | null>
  /** Called with Geoman instance once ready (null on unmount) */
  onGeomanReady?: (gm: Geoman | null) => void
  /** Called when features change on this map */
  onFeaturesChange?: (fc: FeatureCollection) => void
  /** Canonical drawn features to sync from */
  syncFeatures?: FeatureCollection | null
}

/**
 * Headless Geoman initializer — no toolbar UI.
 * Exposes the Geoman instance via onGeomanReady for external control.
 */
export function DrawControl({
  panelId,
  editSourceRef,
  onGeomanReady,
  onFeaturesChange,
  syncFeatures,
}: DrawControlProps) {
  const { map, isLoaded } = useMap()
  const gmRef = useRef<Geoman | null>(null)
  const isSyncingRef = useRef(false)
  const lastFeaturesRef = useRef<FeatureCollection | null>(null)
  const syncVersionRef = useRef(0)
  const [isGeomanReady, setIsGeomanReady] = useState(false)
  const onFeaturesChangeRef = useRef(onFeaturesChange)
  onFeaturesChangeRef.current = onFeaturesChange
  const onGeomanReadyRef = useRef(onGeomanReady)
  onGeomanReadyRef.current = onGeomanReady

  const emitFeatures = useCallback((gm: Geoman) => {
    if (isSyncingRef.current) return
    try {
      const fc = gm.features.exportGeoJson()
      lastFeaturesRef.current = fc
      // Mark this panel as the source BEFORE calling setState
      editSourceRef.current = panelId
      onFeaturesChangeRef.current?.(fc)
    } catch { /* geoman may not be ready */ }
  }, [editSourceRef, panelId])

  // Initialize Geoman
  useEffect(() => {
    if (!map || !isLoaded) return

    setIsGeomanReady(false)
    const gm = new Geoman(map, {
      settings: { controlsUiEnabledByDefault: false },
      layerStyles: LAYER_STYLES,
    })
    gmRef.current = gm

    const onUpdate = () => emitFeatures(gm)

    const onLoaded = () => {
      onGeomanReadyRef.current?.(gm)
      setIsGeomanReady(true)
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
      setIsGeomanReady(false)
      onGeomanReadyRef.current?.(null)
    }
  }, [map, isLoaded, emitFeatures])

  // Sync features when a ready Geoman instance exists and this mounted panel
  // does not already own the exact canonical feature collection.
  // Uses a version counter to cancel stale syncs from overlapping async calls.
  useEffect(() => {
    const gm = gmRef.current
    if (!gm || !isGeomanReady || syncFeatures == null) return
    // Skip only when this live instance already emitted the same collection.
    // A remounted panel may reuse the same panelId but still needs rehydration.
    if (editSourceRef.current === panelId && lastFeaturesRef.current === syncFeatures) return

    const version = ++syncVersionRef.current
    isSyncingRef.current = true
    lastFeaturesRef.current = syncFeatures

    const doSync = async () => {
      try {
        await gm.features.deleteAll()
        // Bail if a newer sync has started
        if (syncVersionRef.current !== version) return
        if (syncFeatures.features.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await gm.features.importGeoJson(syncFeatures as any, { overwrite: true })
        }
      } catch { /* geoman may not be ready */ }
      // Only unlock if this is still the latest sync
      if (syncVersionRef.current === version) {
        isSyncingRef.current = false
      }
    }
    doSync()

    return () => {
      // Invalidate this sync if effect re-runs before it completes
      syncVersionRef.current++
      isSyncingRef.current = false
    }
  }, [syncFeatures, editSourceRef, panelId, isGeomanReady])

  return null
}
