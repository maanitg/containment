import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import './offline/offline.css'
import App from './App.jsx'
import OfflineProvider from './offline/OfflineProvider.jsx'
import { registerServiceWorker } from './offline/register-sw.js'

registerServiceWorker()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <OfflineProvider>
      <App />
    </OfflineProvider>
  </StrictMode>,
)
