import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

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
     VitePWA({
      registerType: 'autoUpdate',

      manifest: {
        name: 'RK Schmalegg',
        short_name: 'RK Schmalegg',

        description: 'Eventmanager RK Schmalegg',

        start_url: '/',
        display: 'standalone',

        background_color: '#ffffff',
        theme_color: '#ffffff',

        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})

