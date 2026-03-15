import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './css/main.css'
import App from './App'

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
      <p className="text-sm text-muted-foreground">地図を読み込み中...</p>
    </div>
  )
}

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <Suspense fallback={<LoadingScreen />}>
      <App />
    </Suspense>
  </StrictMode>
)
