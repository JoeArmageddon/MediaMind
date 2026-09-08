import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Scoped test config: this project has no broader test suite yet. This
// covers the offline-sync/merge logic in src/store (see
// src/store/__tests__) - the highest-risk code touched in the Phase 1
// data-loss fixes. Not wired into `next build`/`next dev`.
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
