import { LAYER_CONFIGS } from '../data/layers.js'

/**
 * A custom Leaflet control to select and display a specific map scale.
 * This version maps scales to known, reliable Leaflet zoom levels, including fractional ones for precision.
 */
const ScaleSelector = L.Control.extend({
  options: {
    position: 'bottomright',
    // A mapping from the display text to a specific, functional Leaflet zoom level.
    // Using fractional zooms to provide distinct levels of detail at high magnifications.
    scales: {
      '1:500': 19.5,
      '1:1,000': 19,
      '1:2,000': 18.5,
      '1:3,000': 18,
      '1:25,000': 15,
      '1:200,000': 12,
    },
    mapManager: null, // Reference to the MapManager to sync both maps
  },

  onAdd: function (map) {
    this._map = map;
    const container = L.DomUtil.create('div', 'leaflet-control-scale-selector leaflet-bar');
    L.DomEvent.disableClickPropagation(container);

    const select = L.DomUtil.create('select', '', container);
    select.style.padding = '5px';
    select.style.fontSize = '12px';
    select.style.border = 'none';
    select.title = 'Select Map Scale';

    for (const [text, zoomLevel] of Object.entries(this.options.scales)) {
      const option = L.DomUtil.create('option', '', select);
      option.value = zoomLevel;
      option.text = text;
    }

    // When the user selects a new scale
    L.DomEvent.on(select, 'change', (e) => {
      // Use parseFloat to handle fractional zoom levels
      const zoomLevel = parseFloat(e.target.value);
      if (this.options.mapManager) {
        this.options.mapManager.setZoom(zoomLevel);
      } else {
        map.setZoom(zoomLevel);
      }
    });

    // Function to update the dropdown based on the map's current state
    this._updateSelect = () => {
      const currentZoom = map.getZoom();
      let bestMatch = null;
      let smallestDiff = Infinity;

      // Find the closest zoom level in our list to the map's current zoom
      for (const option of select.options) {
        // Use parseFloat to handle fractional zoom levels
        const zoomValue = parseFloat(option.value);
        const diff = Math.abs(currentZoom - zoomValue);
        if (diff < smallestDiff) {
          smallestDiff = diff;
          bestMatch = option;
        }
      }
      if (bestMatch) {
        select.value = bestMatch.value;
      }
    };

    // Listen for map movements to keep the selector accurate
    map.on('zoomend', this._updateSelect);
    this._updateSelect(); // Set initial value

    return container;
  },

  onRemove: function (map) {
    map.off('zoomend', this._updateSelect);
  }
});


export class MapManager {
  constructor() {
    this.map1 = null
    this.map2 = null
    this.geojsonLayer1 = null
    this.geojsonLayer2 = null
    this.syncing = true
    this.userLocationMarker = null // To hold the marker for the user's location
  }

  async initializeMaps() {
    console.log('🗺️ Initializing maps...')
    
    const baseLayers1 = this.createBaseLayers()
    const baseLayers2 = this.createBaseLayers()

    // --- THE FIX IS HERE ---
    // Added zoomSnap and zoomDelta to enable smooth, fractional zooming.
    const mapOptions = {
      center: [35.703640, 139.747635],
      zoom: 11, // Default zoom level
      zoomSnap: 0.1, // Allow snapping to finer zoom increments
      zoomDelta: 0.25 // Control zoom speed with mouse/buttons
    };

    // Initialize Map 1 with new options
    this.map1 = L.map('mapcontainer1', {
      ...mapOptions,
      layers: [baseLayers1["GSI Seamless Photo"]]
    })

    // Initialize Map 2 with new options
    this.map2 = L.map('mapcontainer2', {
      ...mapOptions,
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
  }

  updateMapSize() {
    console.log('🗺️ Resizing maps to fit container...');
    if (this.map1 && this.map2) {
      this.map1.invalidateSize();
      this.map2.invalidateSize();
    }
  }

  createBaseLayers() {
    const layers = {}
    Object.entries(LAYER_CONFIGS).forEach(([name, config]) => {
      layers[name] = L.tileLayer(config.url, {
        attribution: config.attribution,
        // It's good practice to define the max zoom supported by the tiles
        maxZoom: 21,
        maxNativeZoom: 18 // Example: GSI tiles might go up to 18
      })
    })
    return layers
  }

  addMapControls(map, baseLayers, geojsonLayer) {
    // Add the standard Leaflet scale bar
    L.control.scale({ 
      maxWidth: 200, 
      position: 'bottomright', 
      imperial: false 
    }).addTo(map)

    // Add our new, precise scale selector control
    new ScaleSelector({
        position: 'bottomright',
        mapManager: this
    }).addTo(map);
    
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

  /**
   * Sets the zoom level for both maps. Can handle fractional zooms.
   * @param {number} zoomLevel - The desired zoom level.
   */
  setZoom(zoomLevel) {
    if (this.map1 && this.map2) {
      this.map1.setZoom(zoomLevel);
      this.map2.setZoom(zoomLevel);
    }
  }

  /**
   * Centers the map on the user's current location.
   * @returns {Promise<string>} A promise that resolves with a success message or rejects with an error.
   */
  centerOnUserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error("Geolocation is not supported by your browser."));
      }

      console.log('🔎 Attempting to get user location...');

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const latLng = [latitude, longitude];
          console.log(`📍 Location found:`, latLng);

          // Center both maps on the user's location with a close zoom level
          this.map1.setView(latLng, 16);
          this.map2.setView(latLng, 16);

          // Remove the old marker if it exists
          if (this.userLocationMarker) {
            this.userLocationMarker.remove();
          }

          // Add a new marker to indicate the user's position
          this.userLocationMarker = L.marker(latLng)
            .addTo(this.map1)
            .bindPopup("<b>Your Location</b><br>You are approximately here.")
            .openPopup();
          
          // Also add to the second map for consistency, without the popup
          L.marker(latLng).addTo(this.map2);

          resolve("Map centered on your location.");
        },
        (error) => {
          console.error('❌ Geolocation error:', error);
          let message = "An unknown error occurred while getting your location.";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = "You denied the request for Geolocation.";
              break;
            case error.POSITION_UNAVAILABLE:
              message = "Location information is unavailable.";
              break;
            case error.TIMEOUT:
              message = "The request to get user location timed out.";
              break;
          }
          reject(new Error(message));
        }
      );
    });
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
    this.map1.setView([35.703640, 139.747635], 11)
    this.map2.setView([35.703640, 139.747635], 11)
    
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