import { useState, useCallback } from 'react'
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Viewport } from '@/hooks/useViewportSync'

interface SearchResult {
  title: string
  longitude: number
  latitude: number
}

interface LocationSearchProps {
  onSelect: (viewport: Viewport) => void
}

export function LocationSearch({ onSelect }: LocationSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const res = await fetch(
        `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`
      )
      const data = await res.json()

      const parsed: SearchResult[] = data
        .slice(0, 10)
        .map((item: { geometry: { coordinates: [number, number] }; properties: { title: string } }) => ({
          title: item.properties.title,
          longitude: item.geometry.coordinates[0],
          latitude: item.geometry.coordinates[1],
        }))

      setResults(parsed)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSelect = (result: SearchResult) => {
    onSelect({
      center: [result.longitude, result.latitude],
      zoom: 15,
      bearing: 0,
      pitch: 0,
    })
    setOpen(false)
    setQuery('')
    setResults([])
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => setOpen(true)}
      >
        住所検索
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 max-w-md">
          <DialogTitle className="sr-only">住所検索</DialogTitle>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="住所・地名を入力..."
              value={query}
              onValueChange={(v) => {
                setQuery(v)
                search(v)
              }}
            />
            <CommandList>
              <CommandEmpty>
                {loading ? '検索中...' : query.length < 2 ? '2文字以上入力してください' : '結果がありません'}
              </CommandEmpty>
              {results.map((result, i) => (
                <CommandItem
                  key={`${result.longitude}-${result.latitude}-${i}`}
                  onSelect={() => handleSelect(result)}
                  className="text-sm"
                >
                  {result.title}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
