// src/js/MapApplication.js
import { MapManager } from './MapManager.js'
import { StorageManager } from './StorageManager.js'
import { UIController } from './UIController.js'
import { ErrorHandler } from './utils/ErrorHandler.js'

export class MapApplication {
  constructor() {
    this.mapManager = new MapManager()
    this.storageManager = new StorageManager()
    this.uiController = new UIController()
    
    // Bind methods to maintain context
    this.handleGeoJSONUpload = this.handleGeoJSONUpload.bind(this)
    this.handleClearData = this.handleClearData.bind(this)
    this.handleSyncToggle = this.handleSyncToggle.bind(this)
    this.handleDebugInfo = this.handleDebugInfo.bind(this)
  }

  async init() {
    try {
      console.log('🚀 Initializing MapApplication...')
      
      // 1. Create UI elements
      this.uiController.createControlPanel()
      
      // 2. Initialize maps
      await this.mapManager.initializeMaps()
      
      // 3. Setup event listeners with proper context
      this.setupEventListeners()
      
      // 4. Load any saved data
      await this.loadSavedData()
      
      console.log('✅ MapApplication initialized successfully')
      
    } catch (error) {
      ErrorHandler.logError(error, 'MapApplication.init')
      throw error
    }
  }

  setupEventListeners() {
    const handlers = {
      onGeoJSONUpload: this.handleGeoJSONUpload,
      onClearData: this.handleClearData,
      onSyncToggle: this.handleSyncToggle,
      onDebugInfo: this.handleDebugInfo
    }
    
    this.uiController.setupEventListeners(handlers)
    console.log('🎛️ Event listeners setup complete')
  }

  async loadSavedData() {
    try {
      const savedData = this.storageManager.load()
      if (savedData) {
        console.log('📁 Found saved GeoJSON:', savedData.filename)
        
        const success = await this.mapManager.loadGeoJSON(savedData.geojson)
        if (success) {
          const timestamp = new Date(savedData.timestamp).toLocaleString()
          this.uiController.updateStatus(`復元: ${savedData.filename} (${timestamp})`)
        } else {
          this.uiController.updateStatus('復元に失敗しました')
          this.storageManager.clear() // Clear corrupted data
        }
      } else {
        this.uiController.updateStatus('GeoJSONファイルをアップロードしてください')
      }
    } catch (error) {
      ErrorHandler.logError(error, 'loadSavedData')
      this.uiController.updateStatus('データの復元中にエラーが発生しました')
    }
  }

  async handleGeoJSONUpload(file) {
    try {
      console.log('📁 Processing file upload:', file.name)
      this.uiController.updateStatus('ファイルを読み込み中...')
      
      // Read file
      const fileContent = await this.readFile(file)
      const geojson = JSON.parse(fileContent)
      
      // Validate GeoJSON (basic)
      this.validateGeoJSON(geojson)
      
      // Load to maps
      const success = await this.mapManager.loadGeoJSON(geojson)
      if (!success) {
        throw new Error('Failed to load GeoJSON to maps')
      }
      
      // Save to storage
      this.storageManager.save(geojson, file.name)
      
      this.uiController.updateStatus(`読み込み・保存完了: ${file.name}`)
      console.log('✅ GeoJSON upload completed successfully')
      
    } catch (error) {
      ErrorHandler.logError(error, 'handleGeoJSONUpload')
      this.uiController.updateStatus('読み込みエラー')
      this.uiController.showError('GeoJSONファイルの読み込みに失敗しました。正しい形式か確認してください。')
    }
  }

  handleClearData() {
    console.log('🗑️ Clear data requested')
    
    if (confirm('GeoJSONデータをクリアしますか？')) {
      try {
        this.mapManager.clearGeoJSON()
        this.storageManager.clear()
        this.uiController.clearFileInput()
        this.uiController.updateStatus('データをクリアしました')
        
        console.log('✅ Data cleared successfully')
      } catch (error) {
        ErrorHandler.logError(error, 'handleClearData')
        this.uiController.showError('データのクリアに失敗しました')
      }
    } else {
      console.log('ℹ️ Clear cancelled by user')
    }
  }

  handleSyncToggle() {
    try {
      const isEnabled = this.mapManager.toggleSync()
      const status = isEnabled ? '同期をオンにしました' : '同期をオフにしました'
      
      this.uiController.updateSyncButton(isEnabled)
      this.uiController.updateStatus(status)
      
      console.log('🔄 Sync toggled:', isEnabled ? 'ON' : 'OFF')
    } catch (error) {
      ErrorHandler.logError(error, 'handleSyncToggle')
    }
  }

  handleDebugInfo() {
    try {
      console.log('🔍 Debug info requested')
      const storageInfo = this.storageManager.getStorageInfo()
      const mapInfo = this.mapManager.getDebugInfo()
      
      const message = `
🗺️ Maps: ${mapInfo.initialized ? '初期化済み' : '未初期化'}
📁 Storage: ${storageInfo.exists ? 'データあり' : 'データなし'}
💾 Size: ${storageInfo.size}
🔄 Sync: ${mapInfo.syncing ? 'オン' : 'オフ'}
📍 Center: ${mapInfo.center}
🔍 Zoom: ${mapInfo.zoom}
      `.trim()
      
      alert(message)
      console.log('Debug Info:', { storageInfo, mapInfo })
      
    } catch (error) {
      ErrorHandler.logError(error, 'handleDebugInfo')
      alert('デバッグ情報の取得に失敗しました')
    }
  }

  // Utility methods
  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = (e) => reject(new Error('File reading failed'))
      reader.readAsText(file)
    })
  }

  validateGeoJSON(geojson) {
    if (!geojson || typeof geojson !== 'object') {
      throw new Error('Invalid GeoJSON: Not an object')
    }
    
    if (!['FeatureCollection', 'Feature', 'GeometryCollection'].includes(geojson.type)) {
      throw new Error('Invalid GeoJSON: Invalid type')
    }
    
    return true
  }
}