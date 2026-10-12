import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: true,
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon.png', 'masked-icon.svg', 'mygroove-symbol.png', 'mygroove-logo.png'],
      manifest: {
        name: 'MyGroove — Cloud Music Player',
        short_name: 'MyGroove',
        description: 'Installable PWA music player streaming audio directly from Google Drive and cloud storage.',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          {
            src: '/mygroove-symbol.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Runtime caching for Google Drive API file listings (metadata only)
        // Stale-While-Revalidate allows the library to be browsable offline immediately
        // while revalidating in the background when network is available.
        // We explicitly DO NOT cache audio streams (alt=media) automatically.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => {
              // Match Drive API file list queries, exclude direct media downloads
              return (
                url.origin === 'https://www.googleapis.com' &&
                url.pathname.startsWith('/drive/v3/files') &&
                !url.searchParams.has('alt')
              );
            },
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'drive-metadata-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
});
