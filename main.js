// main.js - Application Entry Point
import './src/css/main.css'
import './src/css/components.css'
import './src/css/responsive.css'

import { MapApplication } from './src/js/MapApplication.js'
import { ErrorHandler } from './src/js/utils/ErrorHandler.js'

// Global error handling
window.addEventListener('error', (event) => {
  ErrorHandler.logError(event.error, 'Global Error')
  showErrorScreen()
})

window.addEventListener('unhandledrejection', (event) => {
  ErrorHandler.logError(event.reason, 'Unhandled Promise Rejection')
  showErrorScreen()
})

// Show error screen
function showErrorScreen() {
  document.getElementById('loading-screen').style.display = 'none'
  document.getElementById('app').style.display = 'none'
  document.getElementById('error-screen').style.display = 'flex'
}

// Show main app
function showApp() {
  document.getElementById('loading-screen').style.display = 'none'
  document.getElementById('error-screen').style.display = 'none'
  document.getElementById('app').style.display = 'block'
}

// Initialize application
async function initializeApp() {
  try {
    console.log('🚀 Starting GeoMap Viewer...')
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve)
      })
    }

    // Wait for Leaflet to be available
    if (typeof L === 'undefined') {
      await new Promise(resolve => {
        const checkLeaflet = () => {
          if (typeof L !== 'undefined') {
            resolve()
          } else {
            setTimeout(checkLeaflet, 100)
          }
        }
        checkLeaflet()
      })
    }

    // Initialize app
    const app = new MapApplication()
    await app.init()
    
    showApp()
    console.log('✅ GeoMap Viewer ready!')
    
  } catch (error) {
    console.error('❌ Failed to initialize app:', error)
    ErrorHandler.logError(error, 'App Initialization')
    showErrorScreen()
  }
}

// Start the application
initializeApp()