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

  /**
   * Helper method to wait for a Leaflet plugin to be available.
   * @param {string} pluginName - The name of the plugin object to check for (e.g., 'L.PM').
   * @param {number} timeout - The maximum time to wait in milliseconds.
   * @returns {Promise<void>}
   */
  async _waitForLeafletPlugin(pluginName, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        // Check for nested properties like 'L.PM'
        const props = pluginName.split('.');
        let obj = window;
        const exists = props.every(prop => {
          obj = obj[prop];
          return obj;
        });

        if (exists) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Timed out waiting for Leaflet plugin: ${pluginName}`));
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  async initializeMaps() {
    // Wait for the new Leaflet-Geoman plugin to be ready
    await this._waitForLeafletPlugin('L.PM');

    console.log('🗺️ Initializing maps...')
    
    const baseLayers1 = this.createBaseLayers()
    const baseLayers2 = this.createBaseLayers()

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

    // Add the Leaflet-Geoman drawing/measurement controls only to the primary map (map1)
    if (map === this.map1) {
      map.pm.addControls({
        position: 'topleft',
        drawCircle: false,
        drawCircleMarker: false,
        drawMarker: false,
        drawRectangle: true, // Enable rectangle for area measurement
        cutPolygon: false,
        editMode: true,
        removalMode: true,
      });

      // Set the language to Japanese for a better user experience
      map.pm.setLang('ja');

      // Optional: Add custom styling to the drawing tools
      map.pm.setPathOptions({
        color: '#db4a37',
        fillColor: '#db4a37',
        fillOpacity: 0.4,
      });

      // --- Self-contained helper function for area calculation ---
      const calculateGeodesicArea = (latLngs) => {
        const R = 6378137; // Earth's radius in meters
        let area = 0;
        const n = latLngs.length;

        for (let i = 0; i < n; i++) {
          const p1 = latLngs[i];
          const p2 = latLngs[(i + 1) % n];
          area += (p1.lng - p2.lng) * (Math.PI / 180) *
                  (2 + Math.sin(p1.lat * (Math.PI / 180)) + Math.sin(p2.lat * (Math.PI / 180)));
        }
        return Math.abs(area * R * R / 2.0);
      };

      // Helper function to format measurements into a user-friendly string
      const formatMeasurement = (layer) => {
        let text = '計測結果:<br>';
        let hasMeasurement = false;

        // Calculate distance/perimeter for polylines AND polygons
        if (layer instanceof L.Polyline) {
          const latlngs = layer.getLatLngs();
          let distance = 0;
          
          const points = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;

          for (let i = 0; i < points.length - 1; i++) {
              distance += points[i].distanceTo(points[i + 1]);
          }
          
          // For polygons, add the distance from the last point back to the first
          if (layer instanceof L.Polygon && points.length > 1) {
              distance += points[points.length - 1].distanceTo(points[0]);
          }

          hasMeasurement = true;
          // Use '周囲' (Perimeter) for polygons, '距離' (Distance) for lines
          const label = (layer instanceof L.Polygon) ? '周囲' : '距離'; 

          if (distance > 1000) {
              text += `<strong>${label}:</strong> ${(distance / 1000).toFixed(2)} km<br>`;
          } else {
              text += `<strong>${label}:</strong> ${distance.toFixed(2)} m<br>`;
          }
        }
        
        // Calculate and format area ONLY for polygons and rectangles
        if (layer instanceof L.Polygon) {
          const latlngs = layer.getLatLngs();
          const areaLatLngs = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
          const area = calculateGeodesicArea(areaLatLngs);
          
          hasMeasurement = true;
          if (area > 10000) {
            text += `<strong>面積:</strong> ${(area / 10000).toFixed(2)} ha`;
          } else {
            text += `<strong>面積:</strong> ${area.toFixed(2)} m²`;
          }
        }

        return hasMeasurement ? text.trim() : null;
      };

      // Event listener for when a new shape is drawn
      map.on('pm:create', ({ layer }) => {
        const measurementText = formatMeasurement(layer);
        if (measurementText) {
          layer.bindPopup(measurementText).openPopup();
        }
        
        // Add a listener to this specific layer for when it's edited
        layer.on('pm:edit', (e) => {
          const updatedText = formatMeasurement(e.layer);
          if (updatedText) {
            e.layer.setPopupContent(updatedText).openPopup();
          }
        });
      });
    }
    
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