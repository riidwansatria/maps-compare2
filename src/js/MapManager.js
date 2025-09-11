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

  /**
   * Create a temporary scale bar for export that won't be hidden by snapdom
   */
  _createTempScaleBar(mapInstance, mapContainer) {
    const zoom = mapInstance.getZoom();
    const bounds = mapInstance.getBounds();
    const center = bounds.getCenter();
    
    // Calculate meters per pixel at current zoom level
    const metersPerPixel = 40075017 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, zoom + 8);
    
    // Define scale bar widths and their corresponding distances
    const scaleWidths = [100, 80, 50, 30, 20, 10]; // pixels
    let bestScale = null;
    
    for (const width of scaleWidths) {
      const distance = width * metersPerPixel;
      
      // Find a nice round number
      let scale, unit;
      if (distance >= 1000) {
        scale = Math.round(distance / 1000);
        unit = 'km';
        if (scale > 0) {
          bestScale = { width, distance: scale * 1000, label: `${scale} ${unit}` };
          break;
        }
      } else {
        scale = Math.round(distance);
        unit = 'm';
        if (scale > 0) {
          bestScale = { width, distance: scale, label: `${scale} ${unit}` };
          break;
        }
      }
    }
    
    if (!bestScale) {
      return null;
    }
    
    // Calculate the actual width for the rounded distance
    const actualWidth = bestScale.distance / metersPerPixel;
    
    // Create the scale bar element
    const scaleBar = document.createElement('div');
    scaleBar.style.position = 'absolute';
    scaleBar.style.bottom = '10px';
    scaleBar.style.left = '10px';
    scaleBar.style.background = 'rgba(255, 255, 255, 0.9)';
    scaleBar.style.border = '2px solid #333';
    scaleBar.style.borderTop = 'none';
    scaleBar.style.borderRadius = '0 0 3px 3px';
    scaleBar.style.padding = '2px 5px';
    scaleBar.style.fontSize = '11px';
    scaleBar.style.fontFamily = 'Arial, sans-serif';
    scaleBar.style.fontWeight = 'bold';
    scaleBar.style.color = '#333';
    scaleBar.style.zIndex = '10000';
    scaleBar.style.pointerEvents = 'none';
    scaleBar.style.width = `${actualWidth}px`;
    scaleBar.style.textAlign = 'center';
    scaleBar.textContent = bestScale.label;
    
    // Add a line at the bottom
    const scaleLine = document.createElement('div');
    scaleLine.style.position = 'absolute';
    scaleLine.style.bottom = '-2px';
    scaleLine.style.left = '-2px';
    scaleLine.style.right = '-2px';
    scaleLine.style.height = '2px';
    scaleLine.style.background = '#333';
    scaleBar.appendChild(scaleLine);
    
    // Add tick marks
    const leftTick = document.createElement('div');
    leftTick.style.position = 'absolute';
    leftTick.style.bottom = '-2px';
    leftTick.style.left = '-2px';
    leftTick.style.width = '2px';
    leftTick.style.height = '8px';
    leftTick.style.background = '#333';
    scaleBar.appendChild(leftTick);
    
    const rightTick = document.createElement('div');
    rightTick.style.position = 'absolute';
    rightTick.style.bottom = '-2px';
    rightTick.style.right = '-2px';
    rightTick.style.width = '2px';
    rightTick.style.height = '8px';
    rightTick.style.background = '#333';
    scaleBar.appendChild(rightTick);
    
    // Add to map container
    mapContainer.appendChild(scaleBar);
    
    console.log(`Created temporary scale bar: ${bestScale.label} (${actualWidth}px)`);
    
    return scaleBar;
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
    await this._waitForLeafletPlugin('L.Control.Compass');
    // Wait for snapdom to be available
    await this._waitForLeafletPlugin('snapdom');

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
    // Add scale control with better visibility
    const scaleControl = L.control.scale({ 
      maxWidth: 200, 
      position: 'bottomleft', 
      imperial: false,
      metric: true,
      updateWhenIdle: false
    });
    scaleControl.addTo(map);
    
    // Add custom scale selector
    new ScaleSelector({ position: 'bottomright', mapManager: this }).addTo(map);

    // Add compass control
    L.control.compass({
      position: 'topright',
      autoActive: true,
      showDigit: false,
      textErr: '方位磁針は利用できません',
    }).addTo(map);

    // Setup layer controls
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
      drawPolygon: true,
      drawPolyline: true,
      drawRectangle: true,
      drawCircle: false,
      drawCircleMarker: false,
      drawMarker: false,
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
  
  exportMap(mapId) {
    return new Promise(async (resolve, reject) => {
      try {
        const mapInstance = (mapId === 'map1') ? this.map1 : this.map2;
        if (!mapInstance) {
          throw new Error("Map instance not found for export.");
        }

        const mapContainer = mapInstance.getContainer();
        const filename = `map-export-${mapId}-${new Date().toISOString().slice(0,10)}.png`;

        // Hide UI controls for cleaner export
        const uiToHide = mapContainer.querySelectorAll(
          '.leaflet-control-zoom, .leaflet-control-layers, .leaflet-control-scale-selector, .leaflet-pm-toolbar, .leaflet-pm-actions-container, .leaflet-control-geocoder, .leaflet-control-compass, .leaflet-control-scale'
        );
        const originalDisplays = [];

        uiToHide.forEach(el => {
          originalDisplays.push({ element: el, display: el.style.display });
          el.style.display = 'none';
        });

        // Use snapdom for better export quality
        const result = await snapdom.toPng(mapContainer, {
          scale: 2,
          backgroundColor: '#ffffff',
          embedFonts: true,
          compress: true,
          quality: 1.0
        });

        // Create and trigger download
        const link = document.createElement('a');
        link.href = result.src;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Restore UI controls
        originalDisplays.forEach(item => {
          item.element.style.display = item.display;
        });

        console.log(`📸 Map ${mapId} exported as ${filename}`);
        resolve();

      } catch (err) {
        console.error('Map export failed:', err);
        
        // Fallback to html2canvas if snapdom fails
        console.log('Attempting fallback to html2canvas...');
        try {
          await this._exportMapFallback(mapId);
          resolve();
        } catch (fallbackError) {
          console.error('Fallback export also failed:', fallbackError);
          const userFriendlyError = "Failed to capture map image. The current basemap may have security restrictions (CORS) that prevent exporting. Try a different basemap (like GSI) or check the console for more details.";
          reject(new Error(userFriendlyError));
        }
      }
    });
  }

  // Fallback export method using html2canvas
  _exportMapFallback(mapId) {
    return new Promise((resolve, reject) => {
      const mapInstance = (mapId === 'map1') ? this.map1 : this.map2;
      if (!mapInstance) {
        return reject(new Error("Map instance not found for export."));
      }

      const mapContainer = mapInstance.getContainer();
      const filename = `map-export-${mapId}-${new Date().toISOString().slice(0,10)}.png`;

      // Hide UI controls for cleaner export (but keep scale bar visible)
      const uiToHide = mapContainer.querySelectorAll(
        '.leaflet-control-zoom, .leaflet-control-layers, .leaflet-control-scale-selector, .leaflet-pm-toolbar, .leaflet-pm-actions-container, .leaflet-control-geocoder, .leaflet-control-compass'
      );
      const originalDisplays = [];

      uiToHide.forEach(el => {
        originalDisplays.push({ element: el, display: el.style.display });
        el.style.display = 'none';
      });

      // Explicitly ensure scale bar is visible
      const scaleBars = mapContainer.querySelectorAll('.leaflet-control-scale');
      const originalScaleStyles = [];
      scaleBars.forEach(scaleBar => {
        originalScaleStyles.push({
          element: scaleBar,
          display: scaleBar.style.display,
          visibility: scaleBar.style.visibility,
          opacity: scaleBar.style.opacity
        });
        scaleBar.style.display = 'block';
        scaleBar.style.visibility = 'visible';
        scaleBar.style.opacity = '1';
      });

      console.log(`Fallback: Found ${scaleBars.length} scale bars, making them visible for export`);

      html2canvas(mapContainer, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: 2
      }).then(canvas => {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        resolve();
      }).catch(err => {
        reject(err);
      }).finally(() => {
        // Restore the original display style for all hidden elements
        originalDisplays.forEach(item => {
          item.element.style.display = item.display;
        });
        
        // Restore scale bar styles
        originalScaleStyles.forEach(item => {
          item.element.style.display = item.display;
          item.element.style.visibility = item.visibility;
          item.element.style.opacity = item.opacity;
        });
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
    const n = latLngs.length;

    for (let i = 0; i < n; i++) {
      const p1 = latLngs[i];
      const p2 = latLngs[(i + 1) % n];
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