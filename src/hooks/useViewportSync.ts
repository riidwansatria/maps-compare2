import { useState, useCallback } from 'react'

export interface Viewport {
  center: [number, number]
  zoom: number
  bearing: number
  pitch: number
}

const DEFAULT_VIEWPORT: Viewport = {
  center: [139.747635, 35.703640],
  zoom: 11,
  bearing: 0,
  pitch: 0,
}

export function useViewportSync() {
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT)
  const [syncing, setSyncing] = useState(true)

  const onViewportChange = useCallback((vp: Viewport) => {
    setViewport(vp)
  }, [])

  const toggleSync = useCallback(() => {
    setSyncing((prev) => !prev)
  }, [])

  return { viewport, onViewportChange, syncing, toggleSync }
}
