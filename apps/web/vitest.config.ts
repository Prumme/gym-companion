import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

import { vitestBaseConfig } from '@gym-companion/config/vitest/base';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  ...vitestBaseConfig,
  envDir: rootDir,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@gym-companion/validation': path.resolve(rootDir, 'packages/validation/src/index.ts'),
    },
  },
  test: {
    ...vitestBaseConfig.test,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    env: {
      VITE_API_BASE_URL: 'http://localhost:3000',
      VITE_PUBLIC_APP_URL: 'http://localhost:5173',
    },
  },
});
