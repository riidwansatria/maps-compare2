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
      
      console.log('✅ MapApplication initialized successfully')
      
    } catch (error) {
      ErrorHandler.logError(error, 'MapApplication.init')
      throw error
    }
  }

  async finalizeSetup() {
    this.mapManager.updateMapSize();
    await this.loadSavedData();
  }

  setupEventListeners() {
    const handlers = {
      onGeoJSONUpload: this.handleGeoJSONUpload,
      onClearData: this.handleClearData,
      onSyncToggle: this.handleSyncToggle,
      onDebugInfo: this.handleDebugInfo,
      onExportData: this.handleExportData // This now accepts a mapId
    }
    
    this.uiController.setupEventListeners(handlers)
    console.log('🎛️ Event listeners setup complete')
  }

  async loadSavedData() {
    try {
      const savedData = await this.storageManager.load()
      if (savedData && savedData.filename && savedData.geojson) {
        const success = await this.mapManager.loadGeoJSON(savedData.geojson)
        if (success) {
          const timestamp = new Date(savedData.timestamp).toLocaleString()
          this.uiController.updateStatus(`復元: ${savedData.filename} (${timestamp})`)
        } else {
          // ... error handling
        }
      } else {
        this.uiController.updateStatus('GeoJSONファイルをアップロードしてください')
      }
    } catch (error) {
      // ... error handling
    }
  }

  async handleGeoJSONUpload(file) {
    try {
      this.uiController.updateStatus('ファイルを読み込み中...');
      const geojson = await this.storageManager.importFromFile(file);
      const success = await this.mapManager.loadGeoJSON(geojson);
      if (!success) throw new Error('Failed to load GeoJSON to maps');
      await this.storageManager.save(geojson, file.name);
      this.uiController.updateStatus(`読み込み・保存完了: ${file.name}`);
    } catch (error) {
      ErrorHandler.logError(error, 'handleGeoJSONUpload');
      this.uiController.showError(error.message || 'GeoJSONファイルの読み込みに失敗しました。');
    }
  }

  async handleClearData() {
    if (confirm('GeoJSONデータをクリアしますか？')) {
      try {
        await this.mapManager.clearGeoJSON()
        await this.storageManager.clear()
        this.uiController.clearFileInput()
        this.uiController.updateStatus('データをクリアしました')
      } catch (error) {
        // ... error handling
      }
    }
  }

  handleSyncToggle() {
    const isEnabled = this.mapManager.toggleSync()
    const status = isEnabled ? '同期をオンにしました' : '同期をオフにしました'
    this.uiController.updateSyncButton(isEnabled)
    this.uiController.updateStatus(status)
  }

  handleDebugInfo() {
    try {
      const info = this.storageManager.getStorageInfo();
      this._showDebugModal(info);
      console.log('Debug Info:', info);
    } catch (error) {
      // ... error handling
    }
  }

  async handleExportData(mapId) {
    try {
      this.uiController.showToast('マップをエクスポート中...', 'info');
      await this.mapManager.exportMap(mapId);
    } catch (error) {
      ErrorHandler.logError(error, 'handleExportData');
      this.uiController.showError(error.message || 'マップのエクスポートに失敗しました。');
    }
  }

  _showDebugModal(info) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4';
    
    const modal = document.createElement('div');
    modal.className = 'bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col';

    const header = document.createElement('div');
    header.className = 'p-4 border-b flex justify-between items-center';
    header.innerHTML = `<h2 class="text-lg font-semibold">Storage Information</h2><button id="close-debug-modal" class="text-2xl font-light">&times;</button>`;
    
    const body = document.createElement('div');
    body.className = 'p-4 overflow-y-auto';
    
    const pre = document.createElement('pre');
    pre.className = 'text-xs bg-gray-100 p-3 rounded-md';
    pre.textContent = JSON.stringify(info, null, 2);
    body.appendChild(pre);

    modal.appendChild(header);
    modal.appendChild(body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeModal = () => document.body.removeChild(overlay);
    overlay.querySelector('#close-debug-modal').onclick = closeModal;
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    };
  }
}