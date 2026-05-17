import path from 'path';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    entries: [
      'src/main.jsx',
      'src/pages/**/*.jsx',
      'src/components/**/*.jsx'
    ],
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@clerk/react',
      '@clerk/themes',
      'framer-motion',
      'lucide-react',
      'react-leaflet',
      'leaflet',
      'socket.io-client',
      'axios',
      'exifr'
    ],
  },
})
