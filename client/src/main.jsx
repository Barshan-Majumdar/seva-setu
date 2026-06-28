import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import 'leaflet/dist/leaflet.css'
import './index.css'
import './styles/landing.css'
import './styles/dashboard.css'
import './styles/volunteer.css'
import './styles/user-dashboard.css'
import './styles/auth.css'
import './styles/responsive.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Service Workers require HTTPS or localhost — skip in dev to avoid "insecure operation" errors
const isSecureContext = location.protocol === 'https:' || location.hostname === 'localhost';
if ('serviceWorker' in navigator && isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[SW] Registered, scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('[SW] Registration failed:', error.message);
      });
  });
}
