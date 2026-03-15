import { useState, useCallback } from 'react'
import type { GeoJSON } from 'geojson'

const STORAGE_KEY = 'geomap-viewer-data'

interface StoredData {
  geojson: GeoJSON
  filename: string
  timestamp: string
}

export function useGeoJSON() {
  const [geojsonData, setGeojsonData] = useState<GeoJSON | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed: StoredData = JSON.parse(stored)
        return parsed.geojson ?? null
      }
    } catch {
      // ignore
    }
    return null
  })

  const [filename, setFilename] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed: StoredData = JSON.parse(stored)
        return parsed.filename ?? null
      }
    } catch {
      // ignore
    }
    return null
  })

  const loadFile = useCallback(async (file: File) => {
    const text = await file.text()
    const parsed = JSON.parse(text) as GeoJSON

    const payload: StoredData = {
      geojson: parsed,
      filename: file.name,
      timestamp: new Date().toISOString(),
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // storage full — continue without persisting
    }

    setGeojsonData(parsed)
    setFilename(file.name)
  }, [])

  const clearData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setGeojsonData(null)
    setFilename(null)
  }, [])

  return { geojsonData, filename, loadFile, clearData }
}
