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
    this.handleExportData = this.handleExportData.bind(this)
  }

  async init() {
    try {
      console.log('🚀 Initializing MapApplication...')
      
      this.uiController.createControlPanel()
      await this.mapManager.initializeMaps()
      this.setupEventListeners()
      // Note: loadSavedData is now called from finalizeSetup() to prevent race conditions
      
      console.log('✅ MapApplication initialized successfully')
      
    } catch (error) {
      ErrorHandler.logError(error, 'MapApplication.init')
      throw error
    }
  }

  /**
   * Finalizes the application setup after the UI is visible.
   * This should be called from main.js after the app container is displayed.
   */
  async finalizeSetup() {
    // 1. Ensure maps are correctly sized now that the container is visible
    this.mapManager.updateMapSize();
    
    // 2. Load any persisted data, which will now zoom correctly
    await this.loadSavedData();
  }

  setupEventListeners() {
    const handlers = {
      onGeoJSONUpload: this.handleGeoJSONUpload,
      onClearData: this.handleClearData,
      onSyncToggle: this.handleSyncToggle,
      onDebugInfo: this.handleDebugInfo,
      onExportData: this.handleExportData
    }
    
    this.uiController.setupEventListeners(handlers)
    console.log('🎛️ Event listeners setup complete')
  }

  async loadSavedData() {
    try {
      const savedData = await this.storageManager.load() // Now async
      if (savedData && savedData.filename && savedData.geojson) {
        console.log('📁 Found saved GeoJSON:', savedData.filename)
        
        const success = await this.mapManager.loadGeoJSON(savedData.geojson)
        if (success) {
          const timestamp = new Date(savedData.timestamp).toLocaleString()
          this.uiController.updateStatus(`復元: ${savedData.filename} (${timestamp})`)
        } else {
          this.uiController.updateStatus('復元に失敗しました')
          await this.storageManager.clear()
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
      this.uiController.updateStatus('ファイルを読み込み中...');
      
      const geojson = await this.storageManager.importFromFile(file);

      const success = await this.mapManager.loadGeoJSON(geojson);
      if (!success) {
        throw new Error('Failed to load GeoJSON to maps');
      }
      
      await this.storageManager.save(geojson, file.name);
      
      this.uiController.updateStatus(`読み込み・保存完了: ${file.name}`);
      console.log('✅ GeoJSON upload completed successfully');
      
    } catch (error) {
      ErrorHandler.logError(error, 'handleGeoJSONUpload');
      this.uiController.showError(error.message || 'GeoJSONファイルの読み込みに失敗しました。');
    }
  }

  async handleClearData() {
    console.log('🗑️ Clear data requested')
    
    if (confirm('GeoJSONデータをクリアしますか？')) {
      try {
        await this.mapManager.clearGeoJSON()
        await this.storageManager.clear()
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
      const info = this.storageManager.getStorageInfo();
      this._showDebugModal(info); // Replaced alert with custom modal
      console.log('Debug Info:', info);
      
    } catch (error) {
      ErrorHandler.logError(error, 'handleDebugInfo')
      alert('デバッグ情報の取得に失敗しました')
    }
  }

  async handleExportData() {
    try {
      await this.storageManager.exportData('geojson');
    } catch (error) {
      ErrorHandler.logError(error, 'handleExportData');
      this.uiController.showError(error.message || 'データのエクスポートに失敗しました。');
    }
  }

  // --- NEW PRIVATE METHOD FOR DEBUG UI ---
  _showDebugModal(info) {
    // Create overlay
    const overlay = document.createElement('div');
    // THE FIX: Increased z-index to ensure it's on top of all other elements
    overlay.className = 'fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4';
    
    // Create modal panel
    const modal = document.createElement('div');
    modal.className = 'bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col';

    // Modal Header
    const header = document.createElement('div');
    header.className = 'p-4 border-b flex justify-between items-center';
    header.innerHTML = `<h2 class="text-lg font-semibold">Storage Information</h2><button id="close-debug-modal" class="text-2xl font-light">&times;</button>`;
    
    // Modal Body (Scrollable)
    const body = document.createElement('div');
    body.className = 'p-4 overflow-y-auto';
    
    // Format info into a <pre> tag for nice formatting
    const pre = document.createElement('pre');
    pre.className = 'text-xs bg-gray-100 p-3 rounded-md';
    pre.textContent = JSON.stringify(info, null, 2);
    body.appendChild(pre);

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Add close functionality
    const closeModal = () => document.body.removeChild(overlay);
    overlay.querySelector('#close-debug-modal').onclick = closeModal;
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    };
  }
}