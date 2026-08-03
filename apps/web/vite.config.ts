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
      includeAssets: ['icons/icon.svg', 'offline.html'],
      manifest: {
        name: 'Gym Companion',
        short_name: 'GymCompanion',
        description: 'Suivi d’entraînement mobile-first',
        theme_color: '#1f6feb',
        background_color: '#f4f7fb',
        display: 'standalone',
        start_url: '/',
        lang: 'fr',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
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
      '@gym-companion/validation': path.resolve(rootDir, 'packages/validation/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
});
