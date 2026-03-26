import { useState, useCallback, useRef } from 'react'
import { Search } from 'lucide-react'
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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const abortRef = useRef<AbortController>(undefined)

  const search = useCallback(async (q: string, signal: AbortSignal) => {
    setLoading(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=10&accept-language=en&email=panels-mapcompare@users.noreply.github.com`,
        {
          signal,
          referrerPolicy: 'strict-origin-when-cross-origin',
        }
      )
      const data: { display_name: string; lat: string; lon: string }[] = await res.json()

      setResults(
        data.map((item) => ({
          title: item.display_name,
          longitude: parseFloat(item.lon),
          latitude: parseFloat(item.lat),
        }))
      )
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setResults([])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInputChange = useCallback(
    (v: string) => {
      setQuery(v)
      clearTimeout(debounceRef.current)
      abortRef.current?.abort()

      if (v.length < 2) {
        setResults([])
        setLoading(false)
        return
      }

      setLoading(true)
      debounceRef.current = setTimeout(() => {
        const controller = new AbortController()
        abortRef.current = controller
        search(v, controller.signal)
      }, 300)
    },
    [search]
  )

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
      <div
        className="flex h-7 w-60 cursor-pointer items-center gap-2 rounded-md bg-muted/50 px-3 text-xs text-muted-foreground transition-colors hover:bg-muted"
        onClick={() => setOpen(true)}
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span>Search coordinates or location...</span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 max-w-md">
          <DialogTitle className="sr-only">Location Search</DialogTitle>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search for a place or address..."
              value={query}
              onValueChange={handleInputChange}
            />
            <CommandList>
              <CommandEmpty>
                {loading ? 'Searching...' : query.length < 2 ? 'Type at least 2 characters' : 'No results found'}
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
