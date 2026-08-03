import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

import { vitestBaseConfig } from '@gym-companion/config/vitest/base';

export default defineConfig({
  ...vitestBaseConfig,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    ...vitestBaseConfig.test,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
