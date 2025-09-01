import { LAYER_CONFIGS } from '../data/layers.js'

export class MapManager {
  constructor() {
    this.map1 = null
    this.map2 = null
    this.geojsonLayer1 = null
    this.geojsonLayer2 = null
    this.syncing = true
    this.userLocationMarker = null;
  }

  async initializeMaps() {
    console.log('🗺️ Initializing maps...');
    
    const baseLayers1 = this.createBaseLayers();
    const baseLayers2 = this.createBaseLayers();

    this.map1 = L.map('mapcontainer1', {
      center: [35.703640, 139.747635],
      zoom: 10,
      layers: [baseLayers1["GSI Seamless Photo"]]
    });

    this.map2 = L.map('mapcontainer2', {
      center: [35.703640, 139.747635],
      zoom: 10,
      layers: [baseLayers2["Google Maps"]]
    });

    this.geojsonLayer1 = L.featureGroup().addTo(this.map1);
    this.geojsonLayer2 = L.featureGroup().addTo(this.map2);

    this.addMapControls(this.map1, baseLayers1, this.geojsonLayer1);
    this.addMapControls(this.map2, baseLayers2, this.geojsonLayer2);
    
    L.Control.geocoder({ defaultMarkGeocode: true }).addTo(this.map1);

    this.setupMapSync();
    
    console.log('✅ Maps initialized');
    // The old setTimeout has been removed from here.
  }
  
  /**
   * A dedicated method to resize the maps once their container is visible.
   * This fixes the issue where maps don't render correctly on initial load.
   */
  updateMapSize() {
    console.log('🗺️ Resizing maps to fit visible container...');
    if (this.map1 && this.map2) {
      this.map1.invalidateSize();
      this.map2.invalidateSize();
    }
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
    
    const overlayLayers = {
      "GeoJSON": geojsonLayer
    };

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

  centerOnUserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error("Geolocation is not supported by your browser."));
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const latLng = [latitude, longitude];
          this.map1.setView(latLng, 16);
          this.map2.setView(latLng, 16);
          if (this.userLocationMarker) {
            this.userLocationMarker.remove();
          }
          this.userLocationMarker = L.marker(latLng)
            .addTo(this.map1)
            .bindPopup("<b>Your Location</b>")
            .openPopup();
          
          L.marker(latLng).addTo(this.map2);
          resolve("Map centered on your location.");
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  async loadGeoJSON(geojsonData) {
    try {
      this.geojsonLayer1.clearLayers()
      this.geojsonLayer2.clearLayers()
      const layer1 = L.geoJSON(geojsonData)
      const layer2 = L.geoJSON(geojsonData)
      this.geojsonLayer1.addLayer(layer1)
      this.geojsonLayer2.addLayer(layer2)
      const bounds = layer1.getBounds()
      if (bounds.isValid()) {
        this.map1.fitBounds(bounds)
        this.map2.fitBounds(bounds)
      }
      return true
    } catch (error) {
      console.error('❌ Failed to load GeoJSON:', error)
      return false
    }
  }

  clearGeoJSON() {
    this.geojsonLayer1.clearLayers()
    this.geojsonLayer2.clearLayers()
    this.map1.setView([35.703640, 139.747635], 10)
    this.map2.setView([35.703640, 139.747635], 10)
  }

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

