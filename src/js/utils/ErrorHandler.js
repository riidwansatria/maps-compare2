// src/js/utils/ErrorHandler.js
/**
 * ErrorHandler - Comprehensive error management system
 * Handles logging, user notifications, error recovery, and analytics
 */
export class ErrorHandler {
  static instance = null
  
  constructor() {
    if (ErrorHandler.instance) {
      return ErrorHandler.instance
    }
    
    this.errorLog = []
    this.maxLogEntries = 100
    this.isProduction = import.meta.env?.PROD || false
    this.enableConsoleLogging = !this.isProduction
    this.enableUserNotifications = true
    this.enableAnalytics = false // Set to true if you add analytics
    
    // Error categories for better handling
    this.errorCategories = {
      NETWORK: 'network',
      STORAGE: 'storage', 
      GEOJSON: 'geojson',
      MAP: 'map',
      UI: 'ui',
      SYSTEM: 'system',
      USER: 'user'
    }
    
    // Initialize global error handlers
    this.initializeGlobalHandlers()
    
    ErrorHandler.instance = this
  }

  /**
   * Log error with context and automatic categorization
   * @param {Error|string} error - Error object or message
   * @param {string} context - Where the error occurred
   * @param {Object} metadata - Additional error metadata
   * @param {string} category - Error category (optional, auto-detected if not provided)
   */
  static logError(error, context = '', metadata = {}, category = null) {
    const handler = new ErrorHandler()
    return handler.logError(error, context, metadata, category)
  }

  logError(error, context = '', metadata = {}, category = null) {
    try {
      // Normalize error object
      const errorObj = this.normalizeError(error)
      
      // Auto-detect category if not provided
      if (!category) {
        category = this.detectErrorCategory(errorObj, context)
      }
      
      // Create comprehensive error entry
      const errorEntry = {
        id: this.generateErrorId(),
        timestamp: new Date().toISOString(),
        error: errorObj,
        context: context,
        category: category,
        metadata: {
          ...metadata,
          userAgent: navigator.userAgent,
          url: window.location.href,
          stack: errorObj.stack,
          line: this.extractLineNumber(errorObj.stack)
        },
        severity: this.determineSeverity(errorObj, category),
        handled: true
      }
      
      // Add to log (with size management)
      this.addToLog(errorEntry)
      
      // Console logging (development)
      if (this.enableConsoleLogging) {
        this.logToConsole(errorEntry)
      }
      
      // User notification (if appropriate)
      if (this.enableUserNotifications && this.shouldNotifyUser(errorEntry)) {
        this.notifyUser(errorEntry)
      }
      
      // Analytics (if enabled)
      if (this.enableAnalytics) {
        this.sendToAnalytics(errorEntry)
      }
      
      return errorEntry.id
      
    } catch (loggingError) {
      // Fallback: ensure we don't break on logging errors
      console.error('🚨 ErrorHandler failed:', loggingError)
      console.error('🚨 Original error:', error)
    }
  }

  /**
   * Log warning with context
   * @param {string} message - Warning message
   * @param {string} context - Context where warning occurred
   * @param {Object} metadata - Additional metadata
   */
  static logWarning(message, context = '', metadata = {}) {
    const handler = new ErrorHandler()
    return handler.logWarning(message, context, metadata)
  }

  logWarning(message, context = '', metadata = {}) {
    const warningEntry = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      type: 'warning',
      message: message,
      context: context,
      metadata: metadata,
      severity: 'low'
    }
    
    this.addToLog(warningEntry)
    
    if (this.enableConsoleLogging) {
      console.warn(`⚠️ [${context}] ${message}`, metadata)
    }
    
    return warningEntry.id
  }

  /**
   * Log info message with context
   * @param {string} message - Info message
   * @param {string} context - Context
   * @param {Object} metadata - Additional metadata
   */
  static logInfo(message, context = '', metadata = {}) {
    const handler = new ErrorHandler()
    return handler.logInfo(message, context, metadata)
  }

  logInfo(message, context = '', metadata = {}) {
    if (this.enableConsoleLogging) {
      console.log(`ℹ️ [${context}] ${message}`, metadata)
    }
  }

  /**
   * Handle specific GeoJSON errors with user-friendly messages
   * @param {Error} error - GeoJSON related error
   * @param {string} filename - File that caused the error
   */
  static handleGeoJSONError(error, filename = '') {
    const handler = new ErrorHandler()
    return handler.handleGeoJSONError(error, filename)
  }

  handleGeoJSONError(error, filename = '') {
    const context = `GeoJSON Processing: ${filename}`
    const category = this.errorCategories.GEOJSON
    
    // Specific GeoJSON error messages
    const userMessage = this.getGeoJSONErrorMessage(error)
    
    this.logError(error, context, { filename }, category)
    
    // Show user-friendly message
    if (window.uiController) {
      window.uiController.showError(userMessage)
    } else {
      alert(userMessage)
    }
    
    return {
      error: error,
      userMessage: userMessage,
      category: category
    }
  }

  /**
   * Handle map-related errors
   * @param {Error} error - Map error
   * @param {string} mapId - Map identifier
   */
  static handleMapError(error, mapId = '') {
    const handler = new ErrorHandler()
    return handler.handleMapError(error, mapId)
  }

  handleMapError(error, mapId = '') {
    const context = `Map Error: ${mapId}`
    const category = this.errorCategories.MAP
    
    this.logError(error, context, { mapId }, category)
    
    // Attempt map recovery
    this.attemptMapRecovery(mapId, error)
  }

  /**
   * Handle storage errors with fallback strategies
   * @param {Error} error - Storage error
   * @param {string} operation - Storage operation that failed
   */
  static handleStorageError(error, operation = '') {
    const handler = new ErrorHandler()
    return handler.handleStorageError(error, operation)
  }

  handleStorageError(error, operation = '') {
    const context = `Storage Error: ${operation}`
    const category = this.errorCategories.STORAGE
    
    this.logError(error, context, { operation }, category)
    
    // Suggest recovery actions
    const recoveryMessage = this.getStorageRecoveryMessage(error)
    
    if (window.uiController) {
      window.uiController.showError(recoveryMessage)
    }
    
    return recoveryMessage
  }

  /**
   * Get error log for debugging
   * @param {number} limit - Number of recent errors to return
   * @returns {Array} Recent error entries
   */
  static getErrorLog(limit = 10) {
    const handler = new ErrorHandler()
    return handler.getErrorLog(limit)
  }

  getErrorLog(limit = 10) {
    return this.errorLog.slice(-limit).map(entry => ({
      ...entry,
      // Remove sensitive data for client consumption
      metadata: {
        ...entry.metadata,
        userAgent: undefined // Remove for privacy
      }
    }))
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  static getErrorStats() {
    const handler = new ErrorHandler()
    return handler.getErrorStats()
  }

  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      categories: {},
      severity: { low: 0, medium: 0, high: 0, critical: 0 },
      recent: {
        last24h: 0,
        lastHour: 0
      },
      topErrors: {},
      trends: this.calculateErrorTrends()
    }
    
    // Calculate category and severity distribution
    this.errorLog.forEach(entry => {
      // Categories
      const cat = entry.category || 'unknown'
      stats.categories[cat] = (stats.categories[cat] || 0) + 1
      
      // Severity
      const sev = entry.severity || 'medium'
      stats.severity[sev] = (stats.severity[sev] || 0) + 1
      
      // Recent errors
      const errorTime = new Date(entry.timestamp)
      const now = new Date()
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      
      if (errorTime > hourAgo) stats.recent.lastHour++
      if (errorTime > dayAgo) stats.recent.last24h++
      
      // Top errors
      const errorKey = entry.error.message || 'Unknown error'
      stats.topErrors[errorKey] = (stats.topErrors[errorKey] || 0) + 1
    })
    
    return stats
  }

  /**
   * Clear error log
   */
  static clearLog() {
    const handler = new ErrorHandler()
    handler.clearLog()
  }

  clearLog() {
    this.errorLog = []
    console.log('🗑️ Error log cleared')
  }

  /**
   * Export error log as JSON file
   */
  static exportErrorLog() {
    const handler = new ErrorHandler()
    return handler.exportErrorLog()
  }

  exportErrorLog() {
    try {
      const logData = {
        exportDate: new Date().toISOString(),
        version: '1.1',
        stats: this.getErrorStats(),
        errors: this.errorLog
      }
      
      const blob = new Blob([JSON.stringify(logData, null, 2)], {
        type: 'application/json'
      })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `error-log-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      
      URL.revokeObjectURL(url)
      console.log('📥 Error log exported')
      
    } catch (error) {
      console.error('❌ Failed to export error log:', error)
    }
  }

  // Private methods

  initializeGlobalHandlers() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.logError(event.error, 'Global Error', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }, this.errorCategories.SYSTEM)
    })
    
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError(event.reason, 'Unhandled Promise Rejection', {
        promise: event.promise
      }, this.errorCategories.SYSTEM)
    })
    
    console.log('🛡️ Global error handlers initialized')
  }

  normalizeError(error) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    } else if (typeof error === 'string') {
      return {
        name: 'StringError',
        message: error,
        stack: new Error().stack
      }
    } else {
      return {
        name: 'UnknownError',
        message: String(error),
        stack: new Error().stack
      }
    }
  }

  detectErrorCategory(error, context) {
    const message = (error.message || '').toLowerCase()
    const contextLower = context.toLowerCase()
    
    // Network errors
    if (message.includes('fetch') || message.includes('network') || 
        message.includes('cors') || contextLower.includes('network')) {
      return this.errorCategories.NETWORK
    }
    
    // Storage errors
    if (message.includes('storage') || message.includes('quota') ||
        message.includes('localstorage') || contextLower.includes('storage')) {
      return this.errorCategories.STORAGE
    }
    
    // GeoJSON errors
    if (message.includes('geojson') || message.includes('json') ||
        contextLower.includes('geojson') || contextLower.includes('file')) {
      return this.errorCategories.GEOJSON
    }
    
    // Map errors
    if (message.includes('map') || message.includes('leaflet') ||
        contextLower.includes('map') || contextLower.includes('leaflet')) {
      return this.errorCategories.MAP
    }
    
    // UI errors
    if (message.includes('element') || message.includes('dom') ||
        contextLower.includes('ui') || contextLower.includes('element')) {
      return this.errorCategories.UI
    }
    
    return this.errorCategories.SYSTEM
  }

  determineSeverity(error, category) {
    const message = (error.message || '').toLowerCase()
    
    // Critical errors (app-breaking)
    if (message.includes('out of memory') || 
        message.includes('security') ||
        message.includes('permission denied')) {
      return 'critical'
    }
    
    // High severity (major functionality broken)
    if (category === this.errorCategories.MAP ||
        message.includes('initialization') ||
        message.includes('failed to load')) {
      return 'high'
    }
    
    // Medium severity (feature broken but app works)
    if (category === this.errorCategories.GEOJSON ||
        category === this.errorCategories.STORAGE ||
        message.includes('validation')) {
      return 'medium'
    }
    
    // Low severity (minor issues)
    return 'low'
  }

  shouldNotifyUser(errorEntry) {
    const { severity, category } = errorEntry
    
    // Always notify for critical and high severity
    if (severity === 'critical' || severity === 'high') {
      return true
    }
    
    // Notify for medium severity user-facing errors
    if (severity === 'medium' && 
        [this.errorCategories.GEOJSON, this.errorCategories.STORAGE, this.errorCategories.UI].includes(category)) {
      return true
    }
    
    return false
  }

  getGeoJSONErrorMessage(error) {
    const message = (error.message || '').toLowerCase()
    
    if (message.includes('unexpected token')) {
      return 'GeoJSONファイルの形式が正しくありません。有効なJSONファイルか確認してください。'
    }
    
    if (message.includes('invalid type')) {
      return 'GeoJSONの形式が正しくありません。FeatureCollectionまたはFeature形式である必要があります。'
    }
    
    if (message.includes('too large') || message.includes('quota')) {
      return 'ファイルが大きすぎます。50MB以下のファイルを選択してください。'
    }
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'ネットワークエラーが発生しました。インターネット接続を確認してください。'
    }
    
    return 'GeoJSONファイルの処理中にエラーが発生しました。ファイル形式を確認してください。'
  }

  getStorageRecoveryMessage(error) {
    const message = (error.message || '').toLowerCase()
    
    if (message.includes('quota')) {
      return 'ストレージの容量が不足しています。ブラウザのデータを整理するか、小さなファイルを使用してください。'
    }
    
    if (message.includes('security') || message.includes('permission')) {
      return 'ストレージへのアクセスが拒否されました。ブラウザの設定を確認してください。'
    }
    
    if (message.includes('private') || message.includes('incognito')) {
      return 'プライベートモードではデータの保存に制限があります。通常のブラウザウィンドウをお試しください。'
    }
    
    return 'データの保存中にエラーが発生しました。ページを再読み込みしてお試しください。'
  }

  addToLog(errorEntry) {
    this.errorLog.push(errorEntry)
    
    // Maintain log size limit
    if (this.errorLog.length > this.maxLogEntries) {
      this.errorLog = this.errorLog.slice(-this.maxLogEntries)
    }
    
    // Save to localStorage for debugging (in development)
    if (!this.isProduction) {
      try {
        localStorage.setItem('geomap-error-log', JSON.stringify(this.errorLog.slice(-20)))
      } catch (storageError) {
        // Ignore storage errors when logging errors
      }
    }
  }

  logToConsole(errorEntry) {
    const { error, context, category, severity, metadata } = errorEntry
    
    const prefix = this.getConsolePrefix(severity)
    const message = `${prefix} [${category}] ${context}: ${error.message}`
    
    switch (severity) {
      case 'critical':
      case 'high':
        console.error(message, { error, metadata })
        break
      case 'medium':
        console.warn(message, { error, metadata })
        break
      default:
        console.log(message, { error, metadata })
    }
  }

  notifyUser(errorEntry) {
    const { error, category, severity } = errorEntry
    let userMessage
    
    switch (category) {
      case this.errorCategories.GEOJSON:
        userMessage = this.getGeoJSONErrorMessage(error)
        break
      case this.errorCategories.STORAGE:
        userMessage = this.getStorageRecoveryMessage(error)
        break
      case this.errorCategories.NETWORK:
        userMessage = 'ネットワークエラーが発生しました。接続を確認してください。'
        break
      case this.errorCategories.MAP:
        userMessage = '地図の表示中にエラーが発生しました。ページを再読み込みしてください。'
        break
      default:
        userMessage = severity === 'critical' ? 
          'アプリケーションエラーが発生しました。ページを再読み込みしてください。' :
          '操作中にエラーが発生しました。'
    }
    
    // Use UI controller if available, otherwise fallback to alert
    if (window.uiController) {
      window.uiController.showError(userMessage)
    } else {
      alert(userMessage)
    }
  }

  sendToAnalytics(errorEntry) {
    try {
      // Google Analytics 4 example
      if (typeof gtag !== 'undefined') {
        gtag('event', 'exception', {
          description: `${errorEntry.category}: ${errorEntry.error.message}`,
          fatal: errorEntry.severity === 'critical',
          custom_map: {
            error_id: errorEntry.id,
            context: errorEntry.context,
            category: errorEntry.category
          }
        })
      }
      
      // Custom analytics endpoint example
      if (this.analyticsEndpoint) {
        fetch(this.analyticsEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'error',
            data: {
              message: errorEntry.error.message,
              category: errorEntry.category,
              severity: errorEntry.severity,
              context: errorEntry.context,
              timestamp: errorEntry.timestamp
            }
          })
        }).catch(() => {
          // Ignore analytics errors
        })
      }
      
    } catch (analyticsError) {
      // Never let analytics errors break the app
      console.warn('⚠️ Analytics logging failed:', analyticsError.message)
    }
  }

  attemptMapRecovery(mapId, error) {
    console.log(`🔄 Attempting map recovery for: ${mapId}`)
    
    try {
      // Basic recovery strategies
      if (mapId && window.mapManager) {
        // Try to reinitialize the specific map
        setTimeout(() => {
          window.mapManager.reinitializeMap(mapId)
        }, 1000)
      }
      
    } catch (recoveryError) {
      this.logError(recoveryError, 'Map Recovery Failed', { originalMapId: mapId })
    }
  }

  // Utility methods

  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  extractLineNumber(stack) {
    if (!stack) return null
    
    const match = stack.match(/:(\d+):(\d+)/)
    return match ? { line: parseInt(match[1]), column: parseInt(match[2]) } : null
  }

  getConsolePrefix(severity) {
    const prefixes = {
      critical: '🚨',
      high: '❌',
      medium: '⚠️',
      low: 'ℹ️'
    }
    return prefixes[severity] || 'ℹ️'
  }

  calculateErrorTrends() {
    if (this.errorLog.length < 2) return null
    
    const now = new Date()
    const intervals = [
      { name: '1h', ms: 60 * 60 * 1000 },
      { name: '6h', ms: 6 * 60 * 60 * 1000 },
      { name: '24h', ms: 24 * 60 * 60 * 1000 }
    ]
    
    const trends = {}
    
    intervals.forEach(interval => {
      const since = new Date(now.getTime() - interval.ms)
      const count = this.errorLog.filter(entry => 
        new Date(entry.timestamp) > since
      ).length
      
      trends[interval.name] = count
    })
    
    return trends
  }

  // Recovery and debugging methods

  /**
   * Test error handling system
   * @returns {Object} Test results
   */
  static testErrorHandling() {
    const handler = new ErrorHandler()
    
    try {
      // Test different error types
      handler.logError(new Error('Test error'), 'ErrorHandler Test', {}, handler.errorCategories.SYSTEM)
      handler.logWarning('Test warning', 'ErrorHandler Test')
      handler.logInfo('Test info', 'ErrorHandler Test')
      
      return {
        success: true,
        logEntries: handler.errorLog.length,
        lastError: handler.errorLog[handler.errorLog.length - 1]
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get system health information
   * @returns {Object} System health data
   */
  static getSystemHealth() {
    const handler = new ErrorHandler()
    
    const health = {
      timestamp: new Date().toISOString(),
      errors: handler.getErrorStats(),
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        online: navigator.onLine,
        cookieEnabled: navigator.cookieEnabled
      },
      storage: {
        localStorage: !!window.localStorage,
        sessionStorage: !!window.sessionStorage,
        quota: 'checking...'
      },
      performance: {
        memory: performance.memory ? {
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        } : 'not available'
      }
    }
    
    // Check storage quota
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then(estimate => {
        health.storage.quota = {
          used: Math.round((estimate.usage || 0) / 1024 / 1024),
          available: Math.round((estimate.quota || 0) / 1024 / 1024)
        }
      })
    }
    
    return health
  }

  /**
   * Create crash report for critical errors
   * @param {Error} error - Critical error
   * @param {Object} context - Application context
   */
  static createCrashReport(error, context = {}) {
    const handler = new ErrorHandler()
    
    const crashReport = {
      type: 'crash-report',
      timestamp: new Date().toISOString(),
      error: handler.normalizeError(error),
      context: context,
      systemHealth: ErrorHandler.getSystemHealth(),
      errorLog: handler.getErrorLog(20),
      applicationState: {
        url: window.location.href,
        localStorage: Object.keys(localStorage).length,
        mapState: context.mapState || 'unknown'
      }
    }
    
    console.error('🚨 CRASH REPORT:', crashReport)
    
    // Auto-download crash report in development
    if (!handler.isProduction) {
      try {
        const blob = new Blob([JSON.stringify(crashReport, null, 2)], {
          type: 'application/json'
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `crash-report-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
      } catch (downloadError) {
        console.error('Failed to download crash report:', downloadError)
      }
    }
    
    return crashReport
  }

  // Static convenience methods

  /**
   * Quick error logging for common scenarios
   */
  static mapError(error, mapId) {
    return ErrorHandler.logError(error, `Map: ${mapId}`, { mapId }, 'map')
  }

  static storageError(error, operation) {
    return ErrorHandler.logError(error, `Storage: ${operation}`, { operation }, 'storage')
  }

  static fileError(error, filename) {
    return ErrorHandler.logError(error, `File: ${filename}`, { filename }, 'geojson')
  }

  static networkError(error, url) {
    return ErrorHandler.logError(error, `Network: ${url}`, { url }, 'network')
  }

  static uiError(error, component) {
    return ErrorHandler.logError(error, `UI: ${component}`, { component }, 'ui')
  }

  /**
   * Enable or disable features
   */
  static configure(options = {}) {
    const handler = new ErrorHandler()
    
    if (options.enableConsoleLogging !== undefined) {
      handler.enableConsoleLogging = options.enableConsoleLogging
    }
    
    if (options.enableUserNotifications !== undefined) {
      handler.enableUserNotifications = options.enableUserNotifications
    }
    
    if (options.enableAnalytics !== undefined) {
      handler.enableAnalytics = options.enableAnalytics
    }
    
    if (options.analyticsEndpoint) {
      handler.analyticsEndpoint = options.analyticsEndpoint
    }
    
    console.log('⚙️ ErrorHandler configured:', options)
  }

  /**
   * Get debug information for troubleshooting
   */
  static getDebugInfo() {
    const handler = new ErrorHandler()
    
    return {
      errorHandler: {
        version: '1.1',
        logEntries: handler.errorLog.length,
        isProduction: handler.isProduction,
        features: {
          consoleLogging: handler.enableConsoleLogging,
          userNotifications: handler.enableUserNotifications,
          analytics: handler.enableAnalytics
        }
      },
      recentErrors: handler.getErrorLog(5),
      stats: handler.getErrorStats(),
      systemHealth: ErrorHandler.getSystemHealth()
    }
  }
}