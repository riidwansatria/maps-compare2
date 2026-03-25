import type { ReactNode } from 'react'
import { Separator } from '@/components/ui/separator'

interface NavbarProps {
  mode: 'side-by-side' | 'overlay'
  onToggleMode: () => void
  children?: ReactNode
}

export function Navbar({ mode, onToggleMode, children }: NavbarProps) {
  const isOverlay = mode === 'overlay'

  return (
    <nav className="flex h-11 shrink-0 items-center gap-3 bg-background px-4">
      <h1 className="text-sm font-bold tracking-tight">Panels</h1>

      {/* Mode Switcher */}
      <div className="flex rounded-md bg-muted p-0.5">
        <button
          className={`cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            !isOverlay
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={isOverlay ? onToggleMode : undefined}
        >
          Side by Side
        </button>
        <button
          className={`cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            isOverlay
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={!isOverlay ? onToggleMode : undefined}
        >
          Overlay
        </button>
      </div>

      <Separator orientation="vertical" className="h-5" />

      {children}
    </nav>
  )
}
