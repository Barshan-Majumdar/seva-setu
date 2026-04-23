import React from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import { dark } from '@clerk/themes'
import App from './App.jsx'
import './index.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in your .env file")
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider 
      publishableKey={PUBLISHABLE_KEY}
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#38bdf8',
          colorBackground: '#111827',
          colorInputBackground: 'rgba(255,255,255,0.04)',
          colorInputText: '#f1f5f9',
          borderRadius: '0.75rem',
          fontFamily: 'Inter, system-ui, sans-serif',
        },
        elements: {
          card: 'shadow-2xl border border-white/[0.06]',
          formButtonPrimary: 'bg-gradient-to-r from-sky-400 to-indigo-400 hover:shadow-lg hover:shadow-sky-500/25 transition-all',
        }
      }}
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>,
)
