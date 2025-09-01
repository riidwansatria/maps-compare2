// src/js/UIController.js
/**
 * UIController - Manages all user interface interactions and feedback
 * Handles control panel, notifications, file uploads, and user feedback
 */
export class UIController {
  constructor() {
    this.controlPanel = null;
    this.elements = {};
    this.toastQueue = [];
    this.maxToasts = 3;
    
    // UI state
    this.isLoading = false;
    this.currentFile = null;
    
    // Bind ALL event handler methods to maintain context
    this.handleFileSelect = this.handleFileSelect.bind(this);
    this.handleDragOver = this.handleDragOver.bind(this);
    this.handleDragLeave = this.handleDragLeave.bind(this); 
    this.handleDrop = this.handleDrop.bind(this);
    this.preventDefaults = this.preventDefaults.bind(this); 
  }


  /**
   * Create the main control panel with all UI elements
   */
  createControlPanel() {
    try {
      console.log('🎨 Creating control panel...')
      
      // Remove existing panel if it exists
      this.removeExistingPanel()
      
      // Create main panel container
      this.controlPanel = document.createElement('div')
      this.controlPanel.id = 'control-panel'
      this.controlPanel.className = 'control-panel'
      
      // Build panel content
      this.controlPanel.innerHTML = this.getControlPanelHTML()
      
      // Add to page
      const container = document.getElementById('control-panel-container')
      if (container) {
        container.appendChild(this.controlPanel)
      } else {
        document.body.appendChild(this.controlPanel)
      }
      
      // Store element references
      this.cacheElementReferences()
      
      // Setup drag and drop
      this.setupDragAndDrop()
      
      console.log('✅ Control panel created successfully')
      
    } catch (error) {
      console.error('❌ Failed to create control panel:', error)
      throw new Error(`UI creation failed: ${error.message}`)
    }
  }

  /**
   * Setup event listeners for all UI controls
   * @param {Object} handlers - Event handler functions
   */
  setupEventListeners(handlers) {
    try {
      console.log('🎛️ Setting up UI event listeners...')
      
      if (!this.elements.syncBtn || !this.elements.clearBtn || !this.elements.debugBtn || !this.elements.fileInput) {
        throw new Error('UI elements not found - call createControlPanel() first')
      }

      // Sync toggle button
      this.elements.syncBtn.onclick = (e) => {
        console.log('🔄 Sync button clicked')
        e.preventDefault()
        this.setLoading(true)
        try {
          handlers.onSyncToggle()
        } finally {
          this.setLoading(false)
        }
      }

      // File input
      this.elements.fileInput.onchange = async (e) => {
        console.log('📁 File input changed')
        const file = e.target.files[0]
        if (file) {
          this.currentFile = file
          this.setLoading(true)
          try {
            await handlers.onGeoJSONUpload(file)
          } finally {
            this.setLoading(false)
          }
        }
      }

      // Clear button
      this.elements.clearBtn.onclick = (e) => {
        console.log('🗑️ Clear button clicked')
        e.preventDefault()
        handlers.onClearData()
      }

      // Debug button
      this.elements.debugBtn.onclick = (e) => {
        console.log('🔍 Debug button clicked')
        e.preventDefault()
        handlers.onDebugInfo()
      }

      // Export button
      this.elements.exportBtn.onclick = async (e) => {
        console.log('📥 Export button clicked')
        e.preventDefault()
        this.setLoading(true)
        try {
          await handlers.onExportData?.()
          this.showToast('ファイルをダウンロードしました', 'success')
        } catch (error) {
          this.showToast('エクスポートに失敗しました', 'error')
        } finally {
          this.setLoading(false)
        }
      }

      // Keyboard shortcuts
      this.setupKeyboardShortcuts(handlers)
      
      console.log('✅ Event listeners setup complete')
      
    } catch (error) {
      console.error('❌ Failed to setup event listeners:', error)
      throw error
    }
  }

  /**
   * Update the sync button state and appearance
   * @param {boolean} isEnabled - Whether sync is enabled
   */
  updateSyncButton(isEnabled) {
    if (!this.elements.syncBtn) return
    
    this.elements.syncBtn.textContent = isEnabled ? '同期オン' : '同期オフ'
    this.elements.syncBtn.className = `btn ${isEnabled ? 'btn--secondary' : 'btn--outline'}`
    
    // Add visual indicator
    const indicator = this.elements.syncBtn.querySelector('.sync-indicator')
    if (indicator) {
      indicator.className = `sync-indicator ${isEnabled ? 'sync-indicator--on' : 'sync-indicator--off'}`
    }
  }

  /**
   * Update status message with auto-clear
   * @param {string} message - Status message to display
   * @param {string} type - Message type (info, success, warning, error)
   * @param {number} duration - Display duration in milliseconds
   */
  updateStatus(message, type = 'info', duration = 5000) {
    if (!this.elements.statusDiv) return
    
    console.log(`📢 Status (${type}):`, message)
    
    this.elements.statusDiv.textContent = message
    this.elements.statusDiv.className = `status-message status-message--${type}`
    
    // Auto-clear after duration
    if (duration > 0) {
      setTimeout(() => {
        if (this.elements.statusDiv) {
          this.elements.statusDiv.textContent = ''
          this.elements.statusDiv.className = 'status-message'
        }
      }, duration)
    }
  }

  /**
   * Show toast notification
   * @param {string} message - Toast message
   * @param {string} type - Toast type (success, error, warning, info)
   * @param {number} duration - Display duration in milliseconds
   */
  showToast(message, type = 'info', duration = 4000) {
    try {
      const toast = this.createToastElement(message, type)
      this.displayToast(toast, duration)
      
      console.log(`🍞 Toast (${type}):`, message)
      
    } catch (error) {
      console.error('❌ Failed to show toast:', error)
      // Fallback to status message
      this.updateStatus(message, type)
    }
  }

  /**
   * Show error notification with details
   * @param {string} message - Error message
   * @param {Object} details - Additional error details
   */
  showError(message, details = null) {
    console.error('❌ UI Error:', message, details)
    
    this.showToast(message, 'error', 6000)
    this.updateStatus(message, 'error')
    
    // Vibrate on mobile (if supported)
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200])
    }
  }

  /**
   * Show success notification
   * @param {string} message - Success message
   */
  showSuccess(message) {
    console.log('✅ UI Success:', message)
    this.showToast(message, 'success')
    this.updateStatus(message, 'success')
  }

  /**
   * Clear the file input
   */
  clearFileInput() {
    if (this.elements.fileInput) {
      this.elements.fileInput.value = ''
      this.currentFile = null
      this.updateFileInputLabel()
    }
  }

  /**
   * Set loading state for the entire UI
   * @param {boolean} loading - Whether app is loading
   */
  setLoading(loading) {
    this.isLoading = loading
    
    // Update button states
    Object.values(this.elements).forEach(element => {
      if (element && element.tagName === 'BUTTON') {
        element.disabled = loading
      }
    })
    
    // Update file input
    if (this.elements.fileInput) {
      this.elements.fileInput.disabled = loading
    }
    
    // Update loading indicator
    const loadingIndicator = document.querySelector('.loading-indicator')
    if (loadingIndicator) {
      loadingIndicator.style.display = loading ? 'block' : 'none'
    }
    
    // Update cursor
    document.body.style.cursor = loading ? 'wait' : 'default'
  }

  /**
   * Update file input label with current file info
   */
  updateFileInputLabel() {
    const label = this.elements.fileInputLabel
    if (!label) return
    
    if (this.currentFile) {
      const size = this.formatBytes(this.currentFile.size)
      label.innerHTML = `
        <span class="file-icon">📁</span>
        <span class="file-info">
          <span class="file-name">${this.truncateFilename(this.currentFile.name, 20)}</span>
          <span class="file-size">(${size})</span>
        </span>
      `
    } else {
      label.innerHTML = `
        <span class="file-icon">📁</span>
        <span>GeoJSONを選択</span>
      `
    }
  }

  // Private methods

  removeExistingPanel() {
    const existingPanel = document.getElementById('control-panel')
    if (existingPanel) {
      existingPanel.remove()
      console.log('🗑️ Removed existing control panel')
    }
  }

  getControlPanelHTML() {
    return `
      <div class="control-panel__header">
        <h3 class="control-panel__title">
          <span class="title-icon">🗺️</span>
          航空写真比較ツール
        </h3>
        <div class="loading-indicator" style="display: none;">
          <div class="spinner"></div>
        </div>
      </div>
      
      <div class="control-panel__section">
        <label class="control-label">マップ同期</label>
        <button id="syncToggleBtn" class="btn btn--secondary" title="Toggle map synchronization">
          <span class="sync-indicator sync-indicator--on"></span>
          同期オン
        </button>
      </div>
      
      <div class="control-panel__section">
        <label class="control-label">ファイル操作</label>
        <div class="file-input-wrapper">
          <input type="file" id="geojsonInput" accept=".geojson,.json" class="file-input">
          <label for="geojsonInput" id="fileInputLabel" class="file-input-label">
            <span class="file-icon">📁</span>
            <span>GeoJSONを選択</span>
          </label>
        </div>
        <div class="file-actions">
          <button id="clearBtn" class="btn btn--danger btn--small" title="Clear all GeoJSON data">
            <span class="btn-icon">🗑️</span>
            クリア
          </button>
          <button id="exportBtn" class="btn btn--outline btn--small" title="Export current data">
            <span class="btn-icon">📥</span>
            エクスポート
          </button>
        </div>
      </div>
      
      <div class="control-panel__section">
        <label class="control-label">デバッグ</label>
        <button id="debugBtn" class="btn btn--outline btn--small" title="Show storage and debug information">
          <span class="btn-icon">🔍</span>
          ストレージ情報
        </button>
      </div>
      
      <div class="control-panel__status">
        <div id="statusDiv" class="status-message"></div>
      </div>
      
      <!-- Drag and Drop Overlay -->
      <div id="dropOverlay" class="drop-overlay" style="display: none;">
        <div class="drop-message">
          <span class="drop-icon">📁</span>
          <span>GeoJSONファイルをドロップ</span>
        </div>
      </div>
    `
  }

  cacheElementReferences() {
    this.elements = {
      syncBtn: document.getElementById('syncToggleBtn'),
      fileInput: document.getElementById('geojsonInput'),
      fileInputLabel: document.getElementById('fileInputLabel'),
      clearBtn: document.getElementById('clearBtn'),
      exportBtn: document.getElementById('exportBtn'),
      debugBtn: document.getElementById('debugBtn'),
      statusDiv: document.getElementById('statusDiv'),
      dropOverlay: document.getElementById('dropOverlay')
    }
    
    // Validate all elements were found
    const missingElements = Object.entries(this.elements)
      .filter(([key, element]) => !element)
      .map(([key]) => key)
    
    if (missingElements.length > 0) {
      console.warn('⚠️ Missing UI elements:', missingElements)
    }
    
    console.log('📋 UI elements cached:', Object.keys(this.elements).length)
  }

  setupDragAndDrop() {
    if (!this.elements.dropOverlay) return;
    
    // Prevent default drag behaviors on document
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.addEventListener(eventName, this.preventDefaults, false);
    });
    
    // Highlight drop area
    ['dragenter', 'dragover'].forEach(eventName => {
      document.addEventListener(eventName, this.handleDragOver, false);
    });
    
    // Remove highlight - NO MORE .bind(this) here
    ['dragleave', 'drop'].forEach(eventName => {
      document.addEventListener(eventName, this.handleDragLeave, false); // <-- SIMPLIFIED
    });
    
    // Handle dropped files
    document.addEventListener('drop', this.handleDrop, false);
    
    console.log('🖱️ Drag and drop setup complete');
  }

  setupKeyboardShortcuts(handlers) {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + O: Open file
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        this.elements.fileInput?.click()
      }
      
      // Ctrl/Cmd + S: Export/Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handlers.onExportData?.()
      }
      
      // Ctrl/Cmd + Shift + C: Clear data
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        handlers.onClearData?.()
      }
      
      // F1: Debug info
      if (e.key === 'F1') {
        e.preventDefault()
        handlers.onDebugInfo?.()
      }
      
      // Space: Toggle sync
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault()
        handlers.onSyncToggle?.()
      }
    })
    
    console.log('⌨️ Keyboard shortcuts setup complete')
  }

  // Event handlers

  handleFileSelect(e) {
    const file = e.target.files[0]
    if (file) {
      this.currentFile = file
      this.updateFileInputLabel()
      console.log('📁 File selected:', file.name)
    }
  }

  preventDefaults(e) {
    e.preventDefault()
    e.stopPropagation()
  }

  handleDragOver(e) {
    // Use the cached element reference
    if (this.elements.dropOverlay) {
      this.elements.dropOverlay.style.display = 'flex';
    }
  }

  handleDragLeave(e) {
    if (e.relatedTarget === null) { // A better way to detect leaving the window
      if (this.elements.dropOverlay) {
        this.elements.dropOverlay.style.display = 'none';
      }
    }
  }

  async handleDrop(e) {
    // Use the cached element reference
    if (this.elements.dropOverlay) {
      this.elements.dropOverlay.style.display = 'none';
    }
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0]
      
      // Validate file type
      if (!file.name.toLowerCase().match(/\.(geojson|json)$/)) {
        this.showError('サポートされていないファイル形式です。GeoJSONまたはJSONファイルを選択してください。')
        return
      }
      
      // Update file input
      this.currentFile = file
      this.updateFileInputLabel()
      
      // Trigger file upload via input element
      const dt = new DataTransfer()
      dt.items.add(file)
      this.elements.fileInput.files = dt.files
      
      // Trigger change event
      const changeEvent = new Event('change', { bubbles: true })
      this.elements.fileInput.dispatchEvent(changeEvent)
      
      console.log('🎯 File dropped and processed:', file.name)
    }
  }

  // Toast notification system

  createToastElement(message, type) {
    const toast = document.createElement('div')
    toast.className = `toast toast--${type}`
    
    const icon = this.getToastIcon(type)
    toast.innerHTML = `
      <div class="toast__content">
        <span class="toast__icon">${icon}</span>
        <span class="toast__message">${message}</span>
        <button class="toast__close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `
    
    return toast
  }

  displayToast(toast, duration) {
    const container = document.getElementById('toast-container')
    if (!container) {
      console.warn('⚠️ Toast container not found')
      return
    }
    
    // Limit number of toasts
    const existingToasts = container.querySelectorAll('.toast')
    if (existingToasts.length >= this.maxToasts) {
      existingToasts[0].remove()
    }
    
    container.appendChild(toast)
    
    // Auto-remove after duration
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideOut 0.3s ease forwards'
        setTimeout(() => toast.remove(), 300)
      }
    }, duration)
  }

  getToastIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    }
    return icons[type] || icons.info
  }

  // Utility methods

  formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  truncateFilename(filename, maxLength) {
    if (filename.length <= maxLength) return filename
    
    const extension = filename.substring(filename.lastIndexOf('.'))
    const name = filename.substring(0, filename.lastIndexOf('.'))
    const truncatedName = name.substring(0, maxLength - extension.length - 3) + '...'
    
    return truncatedName + extension
  }

  /**
   * Update file statistics display
   * @param {Object} stats - File statistics
   */
  updateFileStats(stats) {
    const statsElement = this.elements.statusDiv
    if (!statsElement || !stats) return
    
    const { features, size, bounds } = stats
    const message = `Features: ${features} | Size: ${this.formatBytes(size)}`
    
    this.updateStatus(message, 'info', 0) // Don't auto-clear
  }

  /**
   * Show loading spinner on specific element
   * @param {HTMLElement} element - Element to show spinner on
   * @param {boolean} show - Whether to show or hide spinner
   */
  showElementLoading(element, show) {
    if (!element) return
    
    if (show) {
      element.classList.add('loading')
      element.disabled = true
      
      // Add spinner if not exists
      if (!element.querySelector('.btn-spinner')) {
        const spinner = document.createElement('span')
        spinner.className = 'btn-spinner'
        element.insertBefore(spinner, element.firstChild)
      }
    } else {
      element.classList.remove('loading')
      element.disabled = false
      
      // Remove spinner
      const spinner = element.querySelector('.btn-spinner')
      if (spinner) {
        spinner.remove()
      }
    }
  }

  /**
   * Animate element (for feedback)
   * @param {HTMLElement} element - Element to animate
   * @param {string} animation - Animation class name
   */
  animateElement(element, animation = 'pulse') {
    if (!element) return
    
    element.classList.add(`animate-${animation}`)
    setTimeout(() => {
      element.classList.remove(`animate-${animation}`)
    }, 600)
  }

  /**
   * Get current UI state for debugging
   * @returns {Object} Current UI state
   */
  getUIState() {
    return {
      isLoading: this.isLoading,
      currentFile: this.currentFile ? {
        name: this.currentFile.name,
        size: this.currentFile.size,
        type: this.currentFile.type
      } : null,
      elementsFound: Object.entries(this.elements).reduce((acc, [key, element]) => {
        acc[key] = !!element
        return acc
      }, {}),
      toastCount: document.querySelectorAll('.toast').length,
      panelVisible: !!this.controlPanel && this.controlPanel.offsetParent !== null
    }
  }

  /**
   * Cleanup UI resources and event listeners
   */
  destroy() {
    console.log('🧹 Cleaning up UI resources...')
    
    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyboardShortcuts)
    document.removeEventListener('dragenter', this.handleDragOver)
    document.removeEventListener('dragover', this.handleDragOver)
    document.removeEventListener('dragleave', this.handleDragLeave)
    document.removeEventListener('drop', this.handleDrop)
    
    // Remove control panel
    if (this.controlPanel) {
      this.controlPanel.remove()
      this.controlPanel = null
    }
    
    // Clear element references
    this.elements = {}
    
    // Clear any remaining toasts
    const toasts = document.querySelectorAll('.toast')
    toasts.forEach(toast => toast.remove())
    
    console.log('✅ UI cleanup complete')
  }

  // Static utility methods

  static createInstance() {
    return new UIController()
  }

  static showGlobalMessage(message, type = 'info') {
    // Global message that works even if UIController isn't initialized
    const notification = document.createElement('div')
    notification.className = `global-notification global-notification--${type}`
    notification.textContent = message
    
    document.body.appendChild(notification)
    
    setTimeout(() => {
      notification.style.opacity = '0'
      setTimeout(() => notification.remove(), 300)
    }, 4000)
  }
}