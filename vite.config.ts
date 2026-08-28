import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // We register the service worker ourselves in main.tsx so we can force
      // a reload the moment a new version is found, instead of a stale tab
      // silently running old code until it happens to be closed and reopened.
      injectRegister: false,
      workbox: {
        // Adds our push/notificationclick listeners into the generated
        // service worker (Workbox itself has no opinion on Web Push).
        importScripts: ['push-sw.js'],
      },
      manifest: {
        name: 'Trip Fund',
        short_name: 'Trip Fund',
        description: 'Family trip fund ledger',
        theme_color: '#171717',
        background_color: '#fafaf9',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
