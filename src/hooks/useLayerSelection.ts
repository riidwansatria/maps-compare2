import { useState } from 'react'
import type { GsiStyleKey } from '@/lib/gsi-styles'

export function useLayerSelection(defaultLeft: GsiStyleKey, defaultRight: GsiStyleKey) {
  const [leftLayer, setLeftLayer] = useState<GsiStyleKey>(defaultLeft)
  const [rightLayer, setRightLayer] = useState<GsiStyleKey>(defaultRight)

  return { leftLayer, setLeftLayer, rightLayer, setRightLayer }
}
