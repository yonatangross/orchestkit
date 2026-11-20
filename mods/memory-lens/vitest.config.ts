/**
 * Vitest config for memory-lens mod.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    restoreMocks: true,
  },
});
