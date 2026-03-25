import { useState, useCallback, useEffect, useRef } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { motion, MotionConfig, AnimatePresence } from 'motion/react'
import {
  MapPin,
  Minus,
  Pentagon,
  Circle,
  Square,
  SquareDashedMousePointer,
  Trash2,
} from 'lucide-react'
import type { Geoman } from '@geoman-io/maplibre-geoman-free'
import type { Position, FeatureCollection } from 'geojson'

// --- measurement helpers (unchanged) ---

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
      results.push(`Distance: ${formatDistance(lineLength(feature.geometry.coordinates))}`)
    }
    if (feature.geometry.type === 'Polygon') {
      const ring = feature.geometry.coordinates[0]
      results.push(`Perimeter: ${formatDistance(lineLength(ring))} / Area: ${formatArea(polygonArea(ring))}`)
    }
  }
  return results
}

// --- toolbar ---

const transition = {
  type: 'spring' as const,
  bounce: 0.1,
  duration: 0.25,
}

type DrawMode = 'marker' | 'line' | 'polygon' | 'circle' | 'rectangle' | 'edit' | null

const tools: { mode: DrawMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'marker', label: 'Pin', icon: <MapPin className="h-4 w-4" /> },
  { mode: 'line', label: 'Line', icon: <Minus className="h-4 w-4" /> },
  { mode: 'rectangle', label: 'Rectangle', icon: <Square className="h-4 w-4" /> },
  { mode: 'circle', label: 'Circle', icon: <Circle className="h-4 w-4" /> },
  { mode: 'polygon', label: 'Polygon', icon: <Pentagon className="h-4 w-4" /> },
  { mode: 'edit', label: 'Edit', icon: <SquareDashedMousePointer className="h-4 w-4" /> },
]

function ToolButton({
  active,
  onClick,
  ariaLabel,
  children,
  variant = 'default',
}: {
  active?: boolean
  onClick?: () => void
  ariaLabel: string
  children: React.ReactNode
  variant?: 'default' | 'destructive'
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={`relative flex h-8 w-8 shrink-0 cursor-pointer select-none appearance-none items-center justify-center rounded-lg transition-colors active:scale-[0.97] ${
              active && variant === 'destructive'
                ? 'bg-destructive text-white'
                : active
                  ? 'bg-foreground text-background'
                  : variant === 'destructive'
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            onClick={onClick}
            aria-label={ariaLabel}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {ariaLabel}
      </TooltipContent>
    </Tooltip>
  )
}

interface DrawToolbarProps {
  geomanInstances: (Geoman | null)[]
  features: FeatureCollection | null
}

export function DrawToolbar({ geomanInstances, features }: DrawToolbarProps) {
  const [activeMode, setActiveMode] = useState<DrawMode>(null)
  const [deleteState, setDeleteState] = useState<'idle' | 'confirm' | 'deleted'>('idle')
  const deleteTimer = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (deleteState === 'confirm') {
      deleteTimer.current = setTimeout(() => setDeleteState('idle'), 3000)
      return () => { if (deleteTimer.current) clearTimeout(deleteTimer.current) }
    }
    if (deleteState === 'deleted') {
      deleteTimer.current = setTimeout(() => setDeleteState('idle'), 2000)
      return () => { if (deleteTimer.current) clearTimeout(deleteTimer.current) }
    }
  }, [deleteState])

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
  const hasMeasurements = measurements.length > 0

  return (
    <TooltipProvider>
    <MotionConfig transition={transition}>
      <div
        className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 select-none"
      >
        <motion.div
          className="overflow-hidden rounded-xl border bg-background/95 shadow-lg backdrop-blur-sm"
          layout
        >
          <div className="flex items-center gap-0.5 p-1.5">
            {tools.map(({ mode, label, icon }) => (
              <ToolButton
                key={mode}
                active={activeMode === mode}
                onClick={() => activateMode(activeMode === mode ? null : mode)}
                ariaLabel={label}
              >
                {icon}
              </ToolButton>
            ))}

            <div className="mx-0.5 h-5 w-px bg-border" />

            {deleteState !== 'idle' ? (
              <Tooltip open>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className={`relative flex h-8 w-8 shrink-0 cursor-pointer select-none appearance-none items-center justify-center rounded-lg transition-colors active:scale-[0.97] ${
                        deleteState === 'confirm'
                          ? 'bg-destructive text-white'
                          : 'text-muted-foreground'
                      }`}
                      onClick={deleteState === 'confirm' ? () => { clearAll(); setDeleteState('deleted') } : undefined}
                      aria-label={deleteState === 'confirm' ? 'Confirm delete?' : 'Deleted'}
                    />
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {deleteState === 'confirm' ? 'Confirm?' : 'Deleted'}
                </TooltipContent>
              </Tooltip>
            ) : (
              <ToolButton
                onClick={() => setDeleteState('confirm')}
                ariaLabel="Delete all"
                variant="destructive"
              >
                <Trash2 className="h-4 w-4" />
              </ToolButton>
            )}

            <AnimatePresence>
              {hasMeasurements && (
                <motion.div
                  className="flex items-center gap-1.5 overflow-hidden"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                >
                  <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />
                  {measurements.map((m, i) => (
                    <span key={i} className="text-xs text-muted-foreground whitespace-nowrap pr-1">
                      {m}
                    </span>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </MotionConfig>
    </TooltipProvider>
  )
}
