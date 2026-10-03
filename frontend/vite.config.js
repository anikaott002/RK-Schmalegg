import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [
          'babel-plugin-react-compiler',
        ],
      },
    }),
    // === SECURITY/DEPLOYMENT UPDATE START: PWA REMOVED ===
    // Keine PWA-Konfiguration mehr. Dadurch wird vite-plugin-pwa aktuell nicht benötigt.
    // === SECURITY/DEPLOYMENT UPDATE END: PWA REMOVED ===
  ]
})
