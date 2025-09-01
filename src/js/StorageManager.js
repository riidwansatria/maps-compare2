// src/js/StorageManager.js
/**
 * StorageManager - Handles persistent data storage for GeoJSON files
 * Supports localStorage with sessionStorage fallback and comprehensive error handling
 */
export class StorageManager {
  constructor() {
    this.storageKey = 'geomap-viewer-data'
    this.metadataKey = 'geomap-viewer-metadata'
    this.version = '1.1'
    this.maxFileSize = 50 * 1024 * 1024 // 50MB limit
  }

  /**
   * Save GeoJSON data with metadata to browser storage
   * @param {Object} geojson - GeoJSON data object
   * @param {string} filename - Original filename
   * @param {Object} options - Additional save options
   * @returns {Promise<Object>} Save result with success status and storage type
   */
  async save(geojson, filename, options = {}) {
    try {
      // Validate inputs
      this.validateGeoJSON(geojson)
      this.validateFilename(filename)

      // Prepare data payload
      const payload = this.createDataPayload(geojson, filename, options)
      const payloadString = JSON.stringify(payload)
      
      // Check size limits
      this.checkSizeLimit(payloadString)
      
      // Attempt to save with fallback strategy
      const saveResult = await this.attemptSave(this.storageKey, payloadString)
      
      // Save metadata separately
      await this.saveMetadata(payload)
      
      console.log(`💾 GeoJSON saved successfully to ${saveResult.storage}:`, {
        filename,
        size: this.formatBytes(payloadString.length),
        features: this.countFeatures(geojson)
      })
      
      return saveResult

    } catch (error) {
      console.error('❌ Failed to save GeoJSON:', error)
      throw new Error(`Storage save failed: ${error.message}`)
    }
  }

  /**
   * Load GeoJSON data from storage
   * @returns {Promise<Object|null>} Loaded data object or null if not found
   */
  async load() {
    try {
      // Try to load main data
      const dataString = await this.loadFromStorage(this.storageKey)
      if (!dataString) {
        console.log('ℹ️ No saved GeoJSON data found')
        return null
      }

      // Parse and validate data
      const data = JSON.parse(dataString)
      if (!this.isValidSavedData(data)) {
        console.warn('⚠️ Invalid saved data structure, clearing...')
        await this.clear()
        return null
      }

      // Check version compatibility
      if (data.version && !this.isVersionCompatible(data.version)) {
        console.warn('⚠️ Incompatible data version, migrating...')
        const migrated = this.migrateData(data)
        if (migrated) {
          await this.save(migrated.geojson, migrated.filename)
          return migrated
        } else {
          await this.clear()
          return null
        }
      }

      console.log(`📁 GeoJSON loaded successfully:`, {
        filename: data.filename,
        size: this.formatBytes(JSON.stringify(data.geojson).length),
        saved: new Date(data.timestamp).toLocaleString(),
        features: this.countFeatures(data.geojson)
      })

      return data

    } catch (error) {
      console.error('❌ Failed to load from storage:', error)
      // Clear potentially corrupted data
      await this.clear()
      return null
    }
  }

  /**
   * Clear all saved data and metadata
   * @returns {Promise<boolean>} Success status
   */
  async clear() {
    try {
      // Clear main data
      localStorage.removeItem(this.storageKey)
      sessionStorage.removeItem(this.storageKey)
      
      // Clear metadata
      localStorage.removeItem(this.metadataKey)
      sessionStorage.removeItem(this.metadataKey)
      
      console.log('🗑️ All storage cleared successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to clear storage:', error)
      return false
    }
  }

  /**
   * Get comprehensive storage information for debugging
   * @returns {Object} Detailed storage statistics and info
   */
  getStorageInfo() {
    try {
      const localData = localStorage.getItem(this.storageKey)
      const sessionData = sessionStorage.getItem(this.storageKey)
      const metadata = this.loadMetadata()

      const info = {
        // Basic info
        exists: !!(localData || sessionData),
        storage: localData ? 'localStorage' : sessionData ? 'sessionStorage' : 'none',
        size: localData ? this.formatBytes(localData.length) : 
              sessionData ? this.formatBytes(sessionData.length) : '0 B',
        
        // Storage keys
        keys: this.getRelevantStorageKeys(),
        
        // Quota information
        quota: this.getStorageQuota(),
        
        // Browser support
        support: this.getStorageSupport(),
        
        // App version
        version: this.version
      }

      // Add data-specific info if available
      if (localData || sessionData) {
        try {
          const data = JSON.parse(localData || sessionData)
          info.filename = data.filename
          info.timestamp = data.timestamp
          info.dataVersion = data.version
          info.features = this.countFeatures(data.geojson)
          info.bounds = this.calculateBounds(data.geojson)
        } catch (parseError) {
          info.error = 'Data exists but cannot be parsed'
        }
      }

      // Add metadata if available
      if (metadata) {
        info.metadata = metadata
      }

      return info

    } catch (error) {
      return {
        error: error.message,
        exists: false,
        support: this.getStorageSupport()
      }
    }
  }

  /**
   * Export current data as downloadable file
   * @param {string} format - Export format ('geojson' or 'json')
   * @returns {Promise<boolean>} Success status
   */
  async exportData(format = 'geojson') {
    try {
      const data = await this.load()
      if (!data) {
        throw new Error('No data to export')
      }

      let content, mimeType, extension

      switch (format.toLowerCase()) {
        case 'geojson':
          content = JSON.stringify(data.geojson, null, 2)
          mimeType = 'application/geo+json'
          extension = '.geojson'
          break
        case 'json':
          content = JSON.stringify(data, null, 2)
          mimeType = 'application/json'
          extension = '.json'
          break
        default:
          throw new Error(`Unsupported export format: ${format}`)
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      
      const filename = data.filename.replace(/\.[^/.]+$/, '') + extension
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.style.display = 'none'
      
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      // Cleanup
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      console.log('📥 Data exported successfully:', filename)
      return true

    } catch (error) {
      console.error('❌ Export failed:', error)
      throw new Error(`Export failed: ${error.message}`)
    }
  }

  /**
   * Import and validate GeoJSON from file
   * @param {File} file - File object to import
   * @returns {Promise<Object>} Parsed and validated GeoJSON
   */
  async importFromFile(file) {
    try {
      this.validateFile(file)
      
      const content = await this.readFileContent(file)
      const geojson = JSON.parse(content)
      
      this.validateGeoJSON(geojson)
      
      console.log(`📁 File imported successfully:`, {
        filename: file.name,
        size: this.formatBytes(file.size),
        features: this.countFeatures(geojson)
      })
      
      return geojson

    } catch (error) {
      console.error('❌ Import failed:', error)
      throw new Error(`Import failed: ${error.message}`)
    }
  }

  // Private helper methods

  createDataPayload(geojson, filename, options) {
    return {
      version: this.version,
      geojson: geojson,
      filename: filename,
      timestamp: new Date().toISOString(),
      size: JSON.stringify(geojson).length,
      features: this.countFeatures(geojson),
      bounds: this.calculateBounds(geojson),
      checksum: this.calculateChecksum(geojson),
      options: options
    }
  }

  async attemptSave(key, data) {
    // Try localStorage first
    try {
      localStorage.setItem(key, data)
      return { success: true, storage: 'localStorage' }
    } catch (localError) {
      console.warn('⚠️ localStorage failed:', localError.message)
      
      // Check if it's a quota error
      if (this.isQuotaError(localError)) {
        console.log('💾 Attempting storage cleanup...')
        await this.cleanupOldData()
        
        // Retry localStorage after cleanup
        try {
          localStorage.setItem(key, data)
          return { success: true, storage: 'localStorage-after-cleanup' }
        } catch (retryError) {
          console.warn('⚠️ localStorage retry failed, using sessionStorage')
        }
      }
      
      // Fallback to sessionStorage
      try {
        sessionStorage.setItem(key, data)
        return { success: true, storage: 'sessionStorage' }
      } catch (sessionError) {
        throw new Error(`All storage methods failed: ${sessionError.message}`)
      }
    }
  }

  async loadFromStorage(key) {
    // Try localStorage first
    let data = localStorage.getItem(key)
    if (data) return data
    
    // Try sessionStorage
    data = sessionStorage.getItem(key)
    return data
  }

  async saveMetadata(payload) {
    const metadata = {
      filename: payload.filename,
      timestamp: payload.timestamp,
      size: payload.size,
      features: payload.features,
      version: payload.version
    }
    
    try {
      localStorage.setItem(this.metadataKey, JSON.stringify(metadata))
    } catch (error) {
      // Metadata save failure is not critical
      console.warn('⚠️ Failed to save metadata:', error.message)
    }
  }

  loadMetadata() {
    try {
      const metadataString = localStorage.getItem(this.metadataKey)
      return metadataString ? JSON.parse(metadataString) : null
    } catch (error) {
      console.warn('⚠️ Failed to load metadata:', error.message)
      return null
    }
  }

  // Validation methods

  validateGeoJSON(geojson) {
    if (!geojson || typeof geojson !== 'object') {
      throw new Error('Invalid GeoJSON: Not an object')
    }
    
    const validTypes = ['FeatureCollection', 'Feature', 'GeometryCollection', 'Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon']
    if (!validTypes.includes(geojson.type)) {
      throw new Error(`Invalid GeoJSON: Invalid type "${geojson.type}"`)
    }
    
    // Additional validation for FeatureCollection
    if (geojson.type === 'FeatureCollection') {
      if (!Array.isArray(geojson.features)) {
        throw new Error('Invalid GeoJSON: FeatureCollection must have features array')
      }
    }
  }

  validateFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      throw new Error('Invalid filename: Must be a non-empty string')
    }
    
    if (filename.length > 255) {
      throw new Error('Invalid filename: Too long (max 255 characters)')
    }
  }

  validateFile(file) {
    if (!file) {
      throw new Error('No file provided')
    }
    
    if (file.size > this.maxFileSize) {
      throw new Error(`File too large: ${this.formatBytes(file.size)} (max: ${this.formatBytes(this.maxFileSize)})`)
    }
    
    const validExtensions = ['.geojson', '.json']
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    if (!validExtensions.includes(extension)) {
      throw new Error(`Invalid file type: ${extension} (supported: ${validExtensions.join(', ')})`)
    }
  }

  checkSizeLimit(dataString) {
    if (dataString.length > this.maxFileSize) {
      throw new Error(`Data too large: ${this.formatBytes(dataString.length)} (max: ${this.formatBytes(this.maxFileSize)})`)
    }
  }

  isValidSavedData(data) {
    return (
      data &&
      typeof data === 'object' &&
      data.geojson &&
      data.filename &&
      data.timestamp &&
      typeof data.geojson === 'object' &&
      typeof data.filename === 'string'
    )
  }

  // Utility methods

  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (event) => {
        resolve(event.target.result)
      }
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }
      
      reader.onabort = () => {
        reject(new Error('File reading was aborted'))
      }
      
      reader.readAsText(file)
    })
  }

  countFeatures(geojson) {
    if (!geojson) return 0
    
    switch (geojson.type) {
      case 'FeatureCollection':
        return geojson.features ? geojson.features.length : 0
      case 'Feature':
        return 1
      default:
        return 1 // Single geometry
    }
  }

  calculateBounds(geojson) {
    if (!geojson) return null
    
    try {
      // Create temporary Leaflet layer to calculate bounds
      const tempLayer = L.geoJSON(geojson)
      const bounds = tempLayer.getBounds()
      
      if (!bounds.isValid()) return null
      
      return {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
        center: bounds.getCenter()
      }
    } catch (error) {
      console.warn('⚠️ Failed to calculate bounds:', error.message)
      return null
    }
  }

  calculateChecksum(geojson) {
    // Simple checksum for data integrity
    const str = JSON.stringify(geojson)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(16)
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Storage management methods

  getRelevantStorageKeys() {
    const keys = []
    const prefixes = ['geomap', 'leaflet', 'map']
    
    // Check localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && prefixes.some(prefix => key.toLowerCase().includes(prefix))) {
        keys.push(`local:${key}`)
      }
    }
    
    // Check sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && prefixes.some(prefix => key.toLowerCase().includes(prefix))) {
        keys.push(`session:${key}`)
      }
    }
    
    return keys
  }

  getStorageQuota() {
    try {
      // Modern quota API
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        navigator.storage.estimate().then(estimate => {
          const quota = {
            used: this.formatBytes(estimate.usage || 0),
            available: this.formatBytes(estimate.quota || 0),
            percentage: estimate.quota ? 
              Math.round((estimate.usage / estimate.quota) * 100) : 0
          }
          console.log('💾 Storage quota:', quota)
          return quota
        }).catch(error => {
          console.warn('⚠️ Failed to get storage estimate:', error)
        })
      }
      
      // Fallback: rough localStorage test
      return this.estimateLocalStorageQuota()

    } catch (error) {
      return {
        error: error.message,
        supported: false
      }
    }
  }

  estimateLocalStorageQuota() {
    try {
      const testKey = 'quota-test'
      let used = 0
      
      // Calculate current usage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        const value = localStorage.getItem(key)
        used += key.length + value.length
      }
      
      return {
        used: this.formatBytes(used),
        available: '~5-10 MB (estimated)',
        percentage: 'unknown',
        method: 'estimated'
      }
    } catch (error) {
      return {
        error: error.message,
        method: 'failed'
      }
    }
  }

  getStorageSupport() {
    return {
      localStorage: typeof(Storage) !== "undefined" && 'localStorage' in window,
      sessionStorage: typeof(Storage) !== "undefined" && 'sessionStorage' in window,
      storageManager: 'storage' in navigator && 'estimate' in navigator.storage,
      fileReader: typeof FileReader !== 'undefined',
      blob: typeof Blob !== 'undefined'
    }
  }

  // Error handling and cleanup

  isQuotaError(error) {
    return error.name === 'QuotaExceededError' || 
           error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
           error.message.toLowerCase().includes('quota')
  }

  async cleanupOldData() {
    try {
      console.log('🧹 Cleaning up old storage data...')
      
      // Remove old app data (if any old versions exist)
      const oldKeys = ['old-geomap-data', 'leaflet-geojson-data', 'map-data']
      oldKeys.forEach(key => {
        localStorage.removeItem(key)
        sessionStorage.removeItem(key)
      })
      
      // Could add more sophisticated cleanup logic here
      console.log('✅ Cleanup completed')
      
    } catch (error) {
      console.warn('⚠️ Cleanup failed:', error.message)
    }
  }

  isVersionCompatible(dataVersion) {
    const currentMajor = parseInt(this.version.split('.')[0])
    const dataMajor = parseInt(dataVersion.split('.')[0])
    
    // Compatible if same major version
    return currentMajor === dataMajor
  }

  migrateData(oldData) {
    try {
      // Simple migration: just update version
      return {
        ...oldData,
        version: this.version,
        migrated: true,
        originalVersion: oldData.version
      }
    } catch (error) {
      console.error('❌ Migration failed:', error)
      return null
    }
  }

  // Static utility methods

  static createInstance() {
    return new StorageManager()
  }

  static async testStorage() {
    const manager = new StorageManager()
    const testData = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [139.7, 35.7] },
        properties: { name: 'Test Point' }
      }]
    }
    
    try {
      await manager.save(testData, 'test.geojson')
      const loaded = await manager.load()
      await manager.clear()
      
      return {
        success: true,
        roundTrip: JSON.stringify(loaded.geojson) === JSON.stringify(testData)
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }
}