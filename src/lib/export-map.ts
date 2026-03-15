import type MapLibreGL from 'maplibre-gl'

export async function exportMap(map: MapLibreGL.Map, label: string) {
  const canvas = map.getCanvas()
  const dataUrl = canvas.toDataURL('image/png')

  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `map-export-${label}-${new Date().toISOString().slice(0, 10)}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
