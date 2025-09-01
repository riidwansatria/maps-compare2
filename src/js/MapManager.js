import { LAYER_CONFIGS } from '../data/layers.js'

export class MapManager {
  constructor() {
    this.map1 = null
    this.map2 = null
    this.geojsonLayer1 = null
    this.geojsonLayer2 = null
    this.syncing = true
  }

  async initializeMaps() {
    console.log('🗺️ Initializing maps...')
    
    const baseLayers1 = this.createBaseLayers()
    const baseLayers2 = this.createBaseLayers()

    // Initialize Map 1
    this.map1 = L.map('mapcontainer1', {
      center: [35.703640, 139.747635],
      zoom: 10,
      layers: [baseLayers1["GSI Seamless Photo"]]
    })

    // Initialize Map 2  
    this.map2 = L.map('mapcontainer2', {
      center: [35.703640, 139.747635],
      zoom: 10,
      layers: [baseLayers2["Google Maps"]]
    })

    // Create GeoJSON layers
    this.geojsonLayer1 = L.featureGroup().addTo(this.map1);
    this.geojsonLayer2 = L.featureGroup().addTo(this.map2);

    // Add controls
    this.addMapControls(this.map1, baseLayers1, this.geojsonLayer1);
    this.addMapControls(this.map2, baseLayers2, this.geojsonLayer2);
    
    // Add geocoder to map1
    L.Control.geocoder({ defaultMarkGeocode: true }).addTo(this.map1);

    // Setup map synchronization
    this.setupMapSync();
    
    console.log('✅ Maps initialized');

    // ====================================================================
    // THE FIX: Invalidate map size after a short delay
    // This gives the browser time to render the CSS layout and ensures
    // Leaflet knows the correct size of its container.
    // ====================================================================
    setTimeout(() => {
      this.map1.invalidateSize();
      this.map2.invalidateSize();
      console.log('🗺️ Map sizes re-validated.');
    }, 100);
  }

  createBaseLayers() {
    const layers = {}
    Object.entries(LAYER_CONFIGS).forEach(([name, config]) => {
      layers[name] = L.tileLayer(config.url, {
        attribution: config.attribution
      })
    })
    return layers
  }

  addMapControls(map, baseLayers, geojsonLayer) {
    L.control.scale({ 
      maxWidth: 200, 
      position: 'bottomright', 
      imperial: false 
    }).addTo(map)
    
    // Create an object for the overlay layers
    const overlayLayers = {
      "GeoJSON": geojsonLayer
    };

    // Add the layer control with both base and overlay layers
    L.control.layers(baseLayers, overlayLayers, { 
      position: 'topleft', 
      collapsed: true 
    }).addTo(map)
  }

  setupMapSync() {
    const syncMaps = (sourceMap, targetMap) => {
      if (!this.syncing) return
      targetMap.setView(sourceMap.getCenter(), sourceMap.getZoom(), { animate: false })
    }

    this.map1.on('move zoomend', () => syncMaps(this.map1, this.map2))
    this.map2.on('move zoomend', () => syncMaps(this.map2, this.map1))
  }

  toggleSync() {
    this.syncing = !this.syncing
    console.log('🔄 Map sync:', this.syncing ? 'ON' : 'OFF')
    return this.syncing
  }

  async loadGeoJSON(geojsonData) {
    try {
      // Clear existing layers
      this.geojsonLayer1.clearLayers()
      this.geojsonLayer2.clearLayers()

      // Add new GeoJSON to both maps
      const layer1 = L.geoJSON(geojsonData)
      const layer2 = L.geoJSON(geojsonData)

      this.geojsonLayer1.addLayer(layer1)
      this.geojsonLayer2.addLayer(layer2)

      // Fit maps to bounds
      const bounds = layer1.getBounds()
      if (bounds.isValid()) {
        this.map1.fitBounds(bounds)
        this.map2.fitBounds(bounds)
      }

      console.log('✅ GeoJSON loaded to maps')
      return true
    } catch (error) {
      console.error('❌ Failed to load GeoJSON:', error)
      return false
    }
  }

  clearGeoJSON() {
    this.geojsonLayer1.clearLayers()
    this.geojsonLayer2.clearLayers()
    
    // Reset to default view
    this.map1.setView([35.703640, 139.747635], 10)
    this.map2.setView([35.703640, 139.747635], 10)
    
    console.log('🗑️ GeoJSON cleared')
  }

  /**
   * Get debug information about the map state.
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    if (!this.map1) {
      return { initialized: false };
    }
    const center = this.map1.getCenter();
    return {
      initialized: true,
      syncing: this.syncing,
      center: `Lat: ${center.lat.toFixed(4)}, Lng: ${center.lng.toFixed(4)}`,
      zoom: this.map1.getZoom()
    };
  }
}

