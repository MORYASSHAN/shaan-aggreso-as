import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/globalSetup.js'],
    setupFiles: ['./test/setupEnv.js'],
    // One in-memory replica set is shared; files run one at a time, each in its own database.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
