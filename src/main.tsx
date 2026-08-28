import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Auto-reload the moment a new deploy is detected, so nobody gets stuck on a
// stale cached version until they happen to fully close and reopen the app.
const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
