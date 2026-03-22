import { useState, useCallback } from 'react'

export type CompareMode = 'side-by-side' | 'overlay'

export function useCompareMode() {
  const [mode, setMode] = useState<CompareMode>('side-by-side')
  const [overlayOpacity, setOverlayOpacity] = useState(0.5)

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'side-by-side' ? 'overlay' : 'side-by-side'))
  }, [])

  return { mode, setMode, toggleMode, overlayOpacity, setOverlayOpacity }
}
