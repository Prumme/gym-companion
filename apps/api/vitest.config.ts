import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

import { vitestBaseConfig } from '@gym-companion/config/vitest/base';

export default defineConfig({
  ...vitestBaseConfig,
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    ...vitestBaseConfig.test,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Les tests d’intégration Nest + Prisma partagent la même base :
    // l’exécution parallèle de fichiers provoque des 400/404 intermittents.
    fileParallelism: false,
  },
});
