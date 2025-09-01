import { LAYER_CONFIGS } from '../data/layers.js'

/**
 * A custom Leaflet control to select and display a specific map scale.
 */
const ScaleSelector = L.Control.extend({
  options: {
    position: 'bottomright',
    scales: {
      '1:500': 19.5,
      '1:1,000': 19,
      '1:2,000': 18.5,
      '1:3,000': 18,
      '1:25,000': 15,
      '1:200,000': 12,
    },
    mapManager: null,
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

    L.DomEvent.on(select, 'change', (e) => {
      const zoomLevel = parseFloat(e.target.value);
      if (this.options.mapManager) {
        this.options.mapManager.setZoom(zoomLevel);
      } else {
        map.setZoom(zoomLevel);
      }
    });

    this._updateSelect = () => {
      const currentZoom = map.getZoom();
      let bestMatch = null;
      let smallestDiff = Infinity;

      for (const option of select.options) {
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

    map.on('zoomend', this._updateSelect);
    this._updateSelect();

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
    this.geomanLayer1 = null
    this.geomanLayer2 = null
    this.syncing = true
    this.userLocationMarker = null

    // Bind methods for robustness
    this.setupMapSync = this.setupMapSync.bind(this);
  }

  async _waitForLeafletPlugin(pluginName, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
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
    await this._waitForLeafletPlugin('L.PM');
    // THE FIX: Wait for the new, more reliable compass plugin
    await this._waitForLeafletPlugin('L.Control.Compass'); 

    console.log('🗺️ Initializing maps...')
    
    const baseLayers1 = this.createBaseLayers()
    const baseLayers2 = this.createBaseLayers()

    const mapOptions = {
      center: [35.703640, 139.747635],
      zoom: 11,
      zoomSnap: 0.1,
      zoomDelta: 0.25,
      preferCanvas: true
    };

    this.map1 = L.map('mapcontainer1', { ...mapOptions, layers: [baseLayers1["GSI Seamless Photo"]] })
    this.map2 = L.map('mapcontainer2', { ...mapOptions, layers: [baseLayers2["Google Maps"]] })

    this.geojsonLayer1 = L.featureGroup().addTo(this.map1);
    this.geojsonLayer2 = L.featureGroup().addTo(this.map2);
    this.geomanLayer1 = L.featureGroup().addTo(this.map1);
    this.geomanLayer2 = L.featureGroup().addTo(this.map2);

    this.addMapControls(this.map1, baseLayers1, this.geojsonLayer1);
    this.addMapControls(this.map2, baseLayers2, this.geojsonLayer2);
    
    L.Control.geocoder({ defaultMarkGeocode: true }).addTo(this.map1);

    this.setupMapSync();
    
    console.log('✅ Maps initialized');
  }

  updateMapSize() {
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
        maxZoom: 21,
        maxNativeZoom: 18,
        crossOrigin: 'anonymous'
      })
    })
    return layers
  }

  addMapControls(map, baseLayers, geojsonLayer) {
    L.control.scale({ maxWidth: 200, position: 'bottomright', imperial: false }).addTo(map);
    new ScaleSelector({ position: 'bottomright', mapManager: this }).addTo(map);

    // THE FIX: Add the new compass control to the top right of the map
    L.control.compass({
      position: 'topright',
      autoActive: true, // Keep the compass visible
      showDigit: false, // Hide the degree number for a cleaner look
      textErr: '方位磁針は利用できません',
    }).addTo(map);

    const overlayLayers = { "GeoJSON": geojsonLayer };
    const geomanLayer = (map === this.map1) ? this.geomanLayer1 : this.geomanLayer2;
    this._initializeGeomanForMap(map, geomanLayer);
    overlayLayers['計測レイヤー'] = geomanLayer;
    
    L.control.layers(baseLayers, overlayLayers, { position: 'topleft', collapsed: true }).addTo(map);
  }

  _initializeGeomanForMap(map, geomanLayer) {
    map.pm.setGlobalOptions({ layerGroup: geomanLayer });
    map.pm.addControls({
      position: 'topleft',
      drawCircle: false,
      drawCircleMarker: false,
      drawMarker: false,
      drawRectangle: true,
      cutPolygon: false,
      editMode: true,
      removalMode: true,
    });
    map.pm.setLang('ja');
    map.pm.setPathOptions({ color: '#db4a37', fillColor: '#db4a37', fillOpacity: 0.4 });

    map.on('pm:create', ({ layer }) => {
      const measurementText = this._formatMeasurement(layer);
      if (measurementText) {
        layer.bindPopup(measurementText).openPopup();
      }
      layer.on('pm:edit', (e) => {
        const updatedText = this._formatMeasurement(e.layer);
        if (updatedText) {
          e.layer.setPopupContent(updatedText).openPopup();
        }
      });
    });
  }
  
  /**
   * Exports the specified map as a PNG image using html2canvas.
   * @param {string} mapId - 'map1' or 'map2'.
   * @returns {Promise<void>}
   */
  exportMap(mapId) {
    return new Promise((resolve, reject) => {
      const mapInstance = (mapId === 'map1') ? this.map1 : this.map2;
      if (!mapInstance) {
        return reject(new Error("Map instance not found for export."));
      }

      const mapContainer = mapInstance.getContainer();
      const filename = `map-export-${mapId}-${new Date().toISOString().slice(0,10)}.png`;

      // Use html2canvas to capture the map container element
      html2canvas(mapContainer, {
        useCORS: true, // This is crucial for loading cross-origin map tiles
        allowTaint: true,
        logging: false, // Set to true for debugging
      }).then(canvas => {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        resolve();
      }).catch(err => {
        console.error('Map export failed:', err);
        const userFriendlyError = "Failed to capture map image. The current basemap may have security restrictions (CORS) that prevent exporting. Try a different basemap (like GSI) or check the console for more details.";
        reject(new Error(userFriendlyError));
      });
    });
  }

  _formatMeasurement(layer) {
    let text = '計測結果:<br>';
    let hasMeasurement = false;

    if (layer instanceof L.Polyline) {
      const latlngs = layer.getLatLngs();
      let distance = 0;
      const points = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
      for (let i = 0; i < points.length - 1; i++) {
          distance += points[i].distanceTo(points[i + 1]);
      }
      if (layer instanceof L.Polygon && points.length > 1) {
          distance += points[points.length - 1].distanceTo(points[0]);
      }
      hasMeasurement = true;
      const label = (layer instanceof L.Polygon) ? '周囲' : '距離'; 
      if (distance > 1000) {
          text += `<strong>${label}:</strong> ${(distance / 1000).toFixed(2)} km<br>`;
      } else {
          text += `<strong>${label}:</strong> ${distance.toFixed(2)} m<br>`;
      }
    }
    
    if (layer instanceof L.Polygon) {
      const latlngs = layer.getLatLngs();
      const areaLatLngs = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
      const area = this._calculateGeodesicArea(areaLatLngs);
      hasMeasurement = true;
      if (area > 10000) {
        text += `<strong>面積:</strong> ${(area / 10000).toFixed(2)} ha`;
      } else {
        text += `<strong>面積:</strong> ${area.toFixed(2)} m²`;
      }
    }

    return hasMeasurement ? text.trim() : null;
  }

  _calculateGeodesicArea(latLngs) {
    const R = 6378137; // Earth's radius in meters
    let area = 0;
    const n = latlngs.length;
    for (let i = 0; i < n; i++) {
      const p1 = latlngs[i];
      const p2 = latlngs[(i + 1) % n];
      area += (p1.lng - p2.lng) * (Math.PI / 180) *
              (2 + Math.sin(p1.lat * (Math.PI / 180)) + Math.sin(p2.lat * (Math.PI / 180)));
    }
    return Math.abs(area * R * R / 2.0);
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
    return this.syncing
  }

  setZoom(zoomLevel) {
    if (this.map1 && this.map2) {
      this.map1.setZoom(zoomLevel);
      this.map2.setZoom(zoomLevel);
    }
  }

  async loadGeoJSON(geojsonData) {
    const wasSyncing = this.syncing;
    this.syncing = false; // Turn off sync to manually position maps

    try {
      if (!this.geojsonLayer1 || !this.geojsonLayer2) {
        console.error("GeoJSON layers are not initialized.");
        return false;
      }
      this.geojsonLayer1.clearLayers();
      this.geojsonLayer2.clearLayers();

      const geoJsonOptions = {
        coordsToLatLng: function (coords) {
          return new L.LatLng(coords[1], coords[0], coords[2]);
        }
      };

      const layer1 = L.geoJSON(geojsonData, geoJsonOptions);
      const layer2 = L.geoJSON(geojsonData, geoJsonOptions);

      this.geojsonLayer1.addLayer(layer1);
      this.geojsonLayer2.addLayer(layer2);

      const bounds = layer1.getBounds();
      if (bounds && bounds.isValid()) {
        // THE FIX: Explicitly set the view on both maps while syncing is off.
        this.map1.fitBounds(bounds);
        this.map2.fitBounds(bounds);
      } else {
        console.warn("GeoJSON loaded, but bounds are not valid. Skipping fitBounds.");
      }

      console.log('✅ GeoJSON loaded to maps');
      return true;
    } catch (error) {
      console.error('❌ An error occurred inside MapManager.loadGeoJSON:', error);
      return false;
    } finally {
      // Re-enable syncing only after both maps are correctly positioned.
      this.syncing = wasSyncing;
    }
  }

  clearGeoJSON() {
    if (this.geojsonLayer1) this.geojsonLayer1.clearLayers();
    if (this.geojsonLayer2) this.geojsonLayer2.clearLayers();
    
    this.map1.setView([35.703640, 139.747635], 11);
    this.map2.setView([35.703640, 139.747635], 11);
    
    console.log('🗑️ GeoJSON cleared');
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
            .bindPopup("<b>現在地</b><br>おおよその位置です")
            .openPopup();
          
          L.marker(latLng).addTo(this.map2);

          resolve("Map centered on your location.");
        },
        (error) => {
          console.error('❌ Geolocation error:', error);
          let message = "位置情報の取得中に不明なエラーが発生しました。";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = "位置情報へのアクセスが拒否されました。";
              break;
            case error.POSITION_UNAVAILABLE:
              message = "位置情報が利用できません。";
              break;
            case error.TIMEOUT:
              message = "位置情報の取得がタイムアウトしました。";
              break;
          }
          reject(new Error(message));
        }
      );
    });
  }

  getDebugInfo() {
    if (!this.map1) {
      return { initialized: false };
    }
    const center = this.map1.getCenter();
    return {
      initialized: true,
      syncing: this.syncing,
      center: `緯度: ${center.lat.toFixed(4)}, 経度: ${center.lng.toFixed(4)}`,
      zoom: this.map1.getZoom()
    };
  }
}