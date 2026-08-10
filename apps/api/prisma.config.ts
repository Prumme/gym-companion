/**
 * Prisma CLI config (remplace package.json#prisma, déprécié depuis 6.19).
 * Le datasource URL reste dans prisma/schema.prisma (Prisma 6).
 */
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node ./prisma/seed.cjs',
  },
});
