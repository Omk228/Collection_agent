import React from 'react'
import ReactDOM from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import App from "./app/App"
import './styles/index.css'
import { initTheme } from './app/services/theme'
import { registerServiceWorker } from './registerServiceWorker'

// Initialize unified Fund Lelo theme
initTheme();

// Initialize PWA Service Worker
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)


