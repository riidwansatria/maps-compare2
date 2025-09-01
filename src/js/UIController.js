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
      // Note: The main class is now handled by Tailwind in the getControlPanelHTML method
      
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
    
    // Update text content
    const textElement = this.elements.syncBtn.querySelector('span:last-child');
    if (textElement) {
        textElement.textContent = isEnabled ? '同期オン' : '同期オフ';
    }

    // Update class for styling
    this.elements.syncBtn.className = isEnabled 
      ? 'flex items-center justify-center gap-2 px-3 py-2 border rounded-md text-sm font-semibold cursor-pointer transition-all duration-200 ease-in-out bg-blue-600 text-white hover:bg-blue-700'
      : 'flex items-center justify-center gap-2 px-3 py-2 border rounded-md text-sm font-semibold cursor-pointer transition-all duration-200 ease-in-out bg-transparent text-gray-500 border-gray-300 hover:bg-gray-100';
    
    // Add visual indicator
    const indicator = this.elements.syncBtn.querySelector('.sync-indicator')
    if (indicator) {
      indicator.className = `sync-indicator w-2 h-2 rounded-full transition-colors duration-300 ease-in-out ${isEnabled ? 'bg-green-400 shadow-[0_0_5px_theme(colors.green.400)]' : 'bg-gray-400'}`
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
    
    this.elements.statusDiv.textContent = message;

    const typeClasses = {
        success: 'text-green-600',
        error: 'text-red-600',
        warning: 'text-yellow-600',
        info: 'text-blue-600'
    };
    
    this.elements.statusDiv.className = `text-sm text-center min-h-[18px] transition-colors duration-300 ${typeClasses[type] || 'text-gray-500'}`;
    
    // Auto-clear after duration
    if (duration > 0) {
      setTimeout(() => {
        if (this.elements.statusDiv) {
          this.elements.statusDiv.textContent = ''
          this.elements.statusDiv.className = 'text-sm text-center min-h-[18px] text-gray-500'
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
        <span class="text-xl">📁</span>
        <div class="flex flex-col">
            <span class="font-semibold text-sm">${this.truncateFilename(this.currentFile.name, 20)}</span>
            <span class="text-xs text-gray-500">(${size})</span>
        </div>
      `
    } else {
      label.innerHTML = `
        <span class="text-xl">📁</span>
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
      <div class="bg-white/95 backdrop-blur-md rounded-lg shadow-lg p-3 border border-gray-200 flex flex-col gap-5 w-64">
        
        <!-- Header -->
        <div class="flex justify-between items-center pb-3 border-b border-gray-200">
          <h3 class="m-0 text-lg font-semibold flex items-center gap-2">
            <span class="text-xl">🗺️</span>
            航空写真比較ツール
          </h3>
          <div class="loading-indicator" style="display: none;">
            <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
        
        <!-- Map Sync Section -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-gray-500 uppercase m-0">マップ同期</label>
          <button id="syncToggleBtn" class="flex items-center justify-center gap-2 px-3 py-2 border rounded-md text-sm font-semibold cursor-pointer transition-all duration-200 ease-in-out bg-blue-600 text-white hover:bg-blue-700" title="Toggle map synchronization">
            <span class="sync-indicator w-2 h-2 rounded-full transition-colors duration-300 ease-in-out bg-green-400 shadow-[0_0_5px_theme(colors.green.400)]"></span>
            <span>同期オン</span>
          </button>
        </div>
        
        <!-- File Operations Section -->
        <div class="flex flex-col gap-2">
          <label class="control-label text-xs font-semibold text-gray-500 uppercase m-0">ファイル操作</label>
          <div class="relative">
            <input type="file" id="geojsonInput" accept=".geojson,.json" class="opacity-0 w-px h-px absolute -z-10">
            <label for="geojsonInput" id="fileInputLabel" class="flex items-center gap-2.5 p-2.5 border-2 border-dashed border-gray-300 rounded-md bg-gray-50 cursor-pointer transition-all duration-200 ease-in-out hover:border-blue-500 hover:bg-blue-50">
              <span class="text-xl">📁</span>
              <span>GeoJSONを選択</span>
            </label>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button id="clearBtn" class="flex items-center justify-center gap-1 px-2 py-1.5 border rounded-md text-xs font-semibold cursor-pointer transition-all duration-200 ease-in-out bg-red-600 text-white hover:bg-red-700" title="Clear all GeoJSON data">
              <span>🗑️</span>
              クリア
            </button>
            <button id="exportBtn" class="flex items-center justify-center gap-1 px-2 py-1.5 border rounded-md text-xs font-semibold cursor-pointer transition-all duration-200 ease-in-out bg-transparent text-gray-500 border-gray-300 hover:bg-gray-100" title="Export current data">
              <span>📥</span>
              エクスポート
            </button>
          </div>
        </div>
        
        <!-- Debug Section -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-gray-500 uppercase m-0">デバッグ</label>
          <button id="debugBtn" class="flex items-center justify-center gap-1 px-2 py-1.5 border rounded-md text-xs font-semibold cursor-pointer transition-all duration-200 ease-in-out bg-transparent text-gray-500 border-gray-300 hover:bg-gray-100" title="Show storage and debug information">
            <span>🔍</span>
            ストレージ情報
          </button>
        </div>
        
        <!-- Status Area -->
        <div class="text-center min-h-[18px]">
          <div id="statusDiv" class="text-sm text-gray-500"></div>
        </div>
        
        <!-- Drag and Drop Overlay (Managed by JS) -->
        <div id="dropOverlay" class="fixed inset-0 bg-black/60 z-[9999] hidden justify-center items-center pointer-events-none">
          <div class="text-white text-2xl font-semibold py-5 px-10 border-2 border-dashed border-white rounded-lg bg-black/20 flex items-center gap-4">
            <span class="text-3xl">📁</span>
            <span>GeoJSONファイルをドロップ</span>
          </div>
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
        this.elements.dropOverlay.classList.remove('hidden');
        this.elements.dropOverlay.classList.add('flex');
    }
  }

  handleDragLeave(e) {
    if (e.relatedTarget === null) { // A better way to detect leaving the window
      if (this.elements.dropOverlay) {
        this.elements.dropOverlay.classList.add('hidden');
        this.elements.dropOverlay.classList.remove('flex');
      }
    }
  }

  async handleDrop(e) {
    // Use the cached element reference
    if (this.elements.dropOverlay) {
        this.elements.dropOverlay.classList.add('hidden');
        this.elements.dropOverlay.classList.remove('flex');
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
    
    const typeClasses = {
        success: 'border-green-500',
        error: 'border-red-500',
        warning: 'border-yellow-500',
        info: 'border-blue-500'
    };

    toast.className = `bg-white rounded-lg shadow-lg p-4 max-w-sm border-l-4 ${typeClasses[type] || 'border-gray-500'} animate-slideIn`;
    
    const icon = this.getToastIcon(type)
    toast.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="text-xl">${icon}</span>
        <span class="flex-grow text-sm">${message}</span>
        <button class="text-gray-400 hover:text-gray-800" onclick="this.parentElement.parentElement.remove()">×</button>
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
    const existingToasts = container.querySelectorAll('div') // more generic selector
    if (existingToasts.length >= this.maxToasts) {
      existingToasts[0].remove()
    }
    
    container.appendChild(toast)
    
    // Auto-remove after duration
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.add('animate-slideOut'); // Add slide out animation class
        setTimeout(() => toast.remove(), 300) // Remove from DOM after animation
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