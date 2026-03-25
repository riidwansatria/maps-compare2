import { Slider } from '@/components/ui/slider'
import { LAYER_LABELS, type GsiStyleKey } from '@/lib/gsi-styles'

interface OpacitySliderProps {
  value: number
  onChange: (value: number) => void
  baseLayer: GsiStyleKey
  overlayLayer: GsiStyleKey
}

export function OpacitySlider({ value, onChange, baseLayer, overlayLayer }: OpacitySliderProps) {
  return (
    <div className="absolute top-6 left-1/2 z-10 -translate-x-1/2">
      <div className="flex w-80 flex-col gap-1.5 rounded-lg border bg-background/90 px-4 py-3 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="truncate max-w-[120px]">{LAYER_LABELS[baseLayer]}</span>
          <span className="text-xs font-medium text-foreground tabular-nums">
            {Math.round(value * 100)}%
          </span>
          <span className="truncate max-w-[120px] text-right">{LAYER_LABELS[overlayLayer]}</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[value * 100]}
          onValueChange={(v) => {
            const val = Array.isArray(v) ? v[0] : v
            onChange(val / 100)
          }}
        />
      </div>
    </div>
  )
}
