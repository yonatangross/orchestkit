import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Allow importing .mjs files from bin/
    alias: {
      '@bin': resolve(__dirname, 'bin'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/**/*.ts',
        // Note: bin/*.mjs scripts are tested via integration tests (child_process.spawn)
        // V8 coverage doesn't track code in spawned processes
      ],
      exclude: [
        '**/__tests__/**',
        '**/dist/**',
        '**/entries/**',
        '**/node_modules/**',
        '**/*.d.ts',
        'vitest.config.ts',
        'esbuild.config.mjs',
        'bin/**/*.mjs',  // Tested via integration, not unit coverage
      ],
      thresholds: {
        // Current baseline - incrementally increase as coverage improves
        // Target: 70% lines, 60% functions, 50% branches
        lines: 40,
        functions: 45,
        branches: 30,
        statements: 40,
      },
    },
  },
});
