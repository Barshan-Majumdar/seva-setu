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
import './styles/user-dashboard.css'

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
          colorBackground: 'transparent',
          colorInputBackground: '#111a20',
          colorInputText: '#f2f7fb',
          colorText: '#f2f7fb',
          colorTextOnPrimaryBackground: '#ffffff',
          borderRadius: '0.75rem',
          fontFamily: 'Manrope, Segoe UI, sans-serif',
        },
        elements: {
          cardBox: { boxShadow: 'none' },
          card: { background: 'transparent', boxShadow: 'none', padding: 0 },
          footer: { background: 'transparent' },
          footerAction: { background: 'transparent' },
          internal: { background: 'transparent' } // In case there are some internal banner classes
        }
      }}
    >
      <AuthTokenBridge />
      <App />
    </ClerkProvider>
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch((error) => {
        console.error('ServiceWorker registration failed: ', error);
      });
  });
}
