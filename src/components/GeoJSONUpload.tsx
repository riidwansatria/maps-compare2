import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface GeoJSONUploadProps {
  filename: string | null
  onFileSelect: (file: File) => void
  onClear: () => void
}

export function GeoJSONUpload({ filename, onFileSelect, onClear }: GeoJSONUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".geojson,.json"
        onChange={handleChange}
        className="hidden"
      />
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => inputRef.current?.click()}
      >
        {filename ? `GeoJSON: ${filename}` : 'GeoJSONを選択'}
      </Button>
      {filename && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-destructive"
          onClick={onClear}
        >
          クリア
        </Button>
      )}
    </div>
  )
}

/** Full-screen drag-and-drop overlay — uses document listeners so it never blocks interaction */
export function DragDropOverlay({ onFileSelect }: { onFileSelect: (file: File) => void }) {
  const [dragging, setDragging] = useState(false)
  const dragCounter = useRef(0)

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      dragCounter.current++
      if (dragCounter.current === 1) setDragging(true)
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCounter.current--
      if (dragCounter.current === 0) setDragging(false)
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      dragCounter.current = 0

      const file = e.dataTransfer?.files[0]
      if (file && /\.(geojson|json)$/i.test(file.name)) {
        onFileSelect(file)
      }
    }

    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)

    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [onFileSelect])

  if (!dragging) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 pointer-events-none">
      <div className="rounded-lg border-2 border-dashed border-white bg-black/20 px-10 py-5 text-2xl font-semibold text-white">
        GeoJSONファイルをドロップ
      </div>
    </div>
  )
}
