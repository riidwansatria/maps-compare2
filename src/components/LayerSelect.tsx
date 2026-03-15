import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GSI_STYLES, LAYER_LABELS, type GsiStyleKey } from '@/lib/gsi-styles'

interface LayerSelectProps {
  value: GsiStyleKey
  onChange: (value: GsiStyleKey) => void
  label: string
}

export function LayerSelect({ value, onChange, label }: LayerSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <Select value={value} onValueChange={(v) => onChange(v as GsiStyleKey)}>
        <SelectTrigger className="h-8 w-48 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(GSI_STYLES) as GsiStyleKey[]).map((key) => (
            <SelectItem key={key} value={key} className="text-xs">
              {LAYER_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
