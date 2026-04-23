import React from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import { dark } from '@clerk/themes'
import App from './App.jsx'
import AuthTokenBridge from './components/AuthTokenBridge.jsx'
import 'leaflet/dist/leaflet.css'
import './index.css'
import './styles/landing.css'
import './styles/dashboard.css'
import './styles/volunteer.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in your .env file')
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#38bdf8',
          colorBackground: '#0b1014',
          colorInputBackground: '#111a20',
          colorInputText: '#f2f7fb',
          borderRadius: '0.75rem',
          fontFamily: 'Manrope, Segoe UI, sans-serif',
        },
      }}
    >
      <AuthTokenBridge />
      <App />
    </ClerkProvider>
  </React.StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}
