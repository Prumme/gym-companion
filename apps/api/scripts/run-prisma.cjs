const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { config } = require('dotenv');

config({ path: path.resolve(__dirname, '../../../.env') });

const prismaEntry = require.resolve('prisma/build/index.js');
const args = process.argv.slice(2);

const result = spawnSync(process.execPath, [prismaEntry, ...args], {
  stdio: 'inherit',
  env: process.env,
  cwd: path.resolve(__dirname, '..'),
});

process.exit(result.status ?? 1);
