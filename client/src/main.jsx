import React from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import App from './App.jsx'
import 'leaflet/dist/leaflet.css'
import './index.css'
import './styles/landing.css'
import './styles/dashboard.css'
import './styles/volunteer.css'
import './styles/user-dashboard.css'
import './styles/auth.css'
import './styles/responsive.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in your .env file')
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={{
        variables: {
          colorPrimary: '#2d6148',
          colorBackground: '#ffffff',
          colorInputBackground: '#ffffff',
          colorInputText: '#0f171d',
          colorText: '#0f171d',
          colorTextSecondary: '#475569',
          colorTextOnPrimaryBackground: '#ffffff',
          borderRadius: '0.75rem',
          fontFamily: 'Inter, Manrope, sans-serif',
        },
        elements: {
          cardBox: { boxShadow: '0 40px 100px rgba(0, 0, 0, 0.05)', border: '1px solid rgba(15, 23, 29, 0.08)' },
          card: { background: '#ffffff', borderRadius: '24px' },
          footer: { background: 'transparent' },
          footerAction: { color: '#2d6148' },
        }
      }}
    >
      <App />
    </ClerkProvider>
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
