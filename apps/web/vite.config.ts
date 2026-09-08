import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  // Charge le .env du monorepo (VITE_API_BASE_URL, VITE_PUBLIC_APP_URL).
  envDir: rootDir,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'icons/icon.svg',
        'icons/icon-maskable.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-192.png',
        'icons/icon-maskable-512.png',
        'icons/favicon-16.png',
        'icons/favicon-32.png',
        'offline.html',
      ],
      manifest: {
        name: 'Gym Companion',
        short_name: 'GymCompanion',
        description: 'Suivi d’entraînement mobile-first',
        // Couleurs alignées sur --primary / --background (apps/web/src/styles/global.css).
        theme_color: '#b7f34a',
        background_color: '#f5f6f3',
        display: 'standalone',
        start_url: '/',
        lang: 'fr',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Le bundle principal dépasse 2 MiB ; sans ceci le SW refuse de précacher le shell.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Ne jamais mettre en cache les API privées (séances, auth, etc.).
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Source TS : le dist CJS hors node_modules n’est pas transformé correctement par Rollup.
      '@gym-companion/shared': path.resolve(rootDir, 'packages/shared/src/index.ts'),
      '@gym-companion/validation': path.resolve(rootDir, 'packages/validation/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
});
