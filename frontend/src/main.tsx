import React from 'react'
import ReactDOM from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import App from "./app/App"
import './styles/index.css'
import { initTheme } from './app/services/theme'

// Initialize unified Fund Lelo theme
initTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

